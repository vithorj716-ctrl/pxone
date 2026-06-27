import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EmpresaLite = {
  id: string;
  codigo: string | null;
  nome: string;
  nome_fantasia: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  segmento: string | null;
  situacao: string | null;
};

type Ctx = {
  empresa: EmpresaLite | null;
  isGrupo: boolean;
  empresas: EmpresaLite[];
  loading: boolean;
  setEmpresa: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const EmpresaCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "px:empresa-ativa";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("empresas")
        .select("id, codigo, nome, nome_fantasia, logo_url, cor_primaria, cor_secundaria, segmento, situacao")
        .order("nome", { ascending: true });
      setEmpresas((data ?? []) as EmpresaLite[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEmpresaId(saved === "__grupo__" ? null : saved);
    } catch {}
    void load();
  }, [load]);

  const setEmpresa = useCallback((id: string | null) => {
    setEmpresaId(id);
    try { localStorage.setItem(STORAGE_KEY, id ?? "__grupo__"); } catch {}
  }, []);

  const empresa = useMemo(
    () => empresas.find((e) => e.id === empresaId) ?? null,
    [empresas, empresaId],
  );
  const isGrupo = empresaId === null;

  // Aplica cor primária da empresa ativa como acento sutil
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (empresa?.cor_primaria) {
      root.style.setProperty("--px-empresa-accent", empresa.cor_primaria);
    } else {
      root.style.removeProperty("--px-empresa-accent");
    }
  }, [empresa]);

  const value: Ctx = { empresa, isGrupo, empresas, loading, setEmpresa, refresh: load };
  return <EmpresaCtx.Provider value={value}>{children}</EmpresaCtx.Provider>;
}

export function useEmpresaAtiva() {
  const ctx = useContext(EmpresaCtx);
  if (!ctx) throw new Error("useEmpresaAtiva deve ser usado dentro de <EmpresaProvider>");
  return ctx;
}
