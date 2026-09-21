import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PX_SYSTEMS, type PxSystem } from "./systems";

const STORAGE_KEY = "px:active-system";

type Ctx = {
  loading: boolean;
  allowedSystems: PxSystem[];
  activeSystem: PxSystem | null;
  setActiveSystem: (key: string | null) => void;
  refresh: () => Promise<void>;
  touchLastAccess: (key: string) => Promise<void>;
};

const SystemCtx = createContext<Ctx | null>(null);

export function SystemProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowedKeys, setAllowedKeys] = useState<string[]>([]);
  const [activeKey, setActiveKeyState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAllowedKeys([]);
        return;
      }
      const { data } = await supabase
        .from("px_usuario_sistemas")
        .select("sistema_key")
        .eq("ativo", true)
        .eq("user_id", userData.user.id);
      let keys = (data ?? []).map((r: any) => r.sistema_key as string);
      if (keys.length === 0) {
        // Fallback defensivo: roles executivas acessam todos os sistemas ativos
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        const isExec = (roles ?? []).some((r: any) =>
          ["master_admin", "socio", "diretor"].includes(r.role),
        );
        if (isExec) keys = PX_SYSTEMS.filter((s) => s.status === "ativo").map((s) => s.key);
      }
      setAllowedKeys(keys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setActiveKeyState(saved);
    } catch {}
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);


  const setActiveSystem = useCallback((key: string | null) => {
    setActiveKeyState(key);
    try {
      if (key) sessionStorage.setItem(STORAGE_KEY, key);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const touchLastAccess = useCallback(async (key: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from("px_usuario_sistemas")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("user_id", userData.user.id)
      .eq("sistema_key", key);
  }, []);

  const allowedSystems = useMemo(
    () => PX_SYSTEMS.filter((s) => allowedKeys.includes(s.key) && s.status === "ativo"),
    [allowedKeys],
  );

  const activeSystem = useMemo(
    () => PX_SYSTEMS.find((s) => s.key === activeKey) ?? null,
    [activeKey],
  );

  return (
    <SystemCtx.Provider value={{ loading, allowedSystems, activeSystem, setActiveSystem, refresh, touchLastAccess }}>
      {children}
    </SystemCtx.Provider>
  );
}

export function useSystem() {
  const ctx = useContext(SystemCtx);
  if (!ctx) throw new Error("useSystem deve estar dentro de <SystemProvider>");
  return ctx;
}
