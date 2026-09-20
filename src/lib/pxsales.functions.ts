import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PXSALES_SISTEMA_KEY, PXSALES_PERMISSION_ACTIONS } from "@/pxsales/pxsales.permissions";
import type { PxSalesAccess } from "@/pxsales/pxsales.types";

/**
 * Gate de acesso ao PXSales — validado SEMPRE no servidor.
 * Reutiliza has_system_access()/is_executive() e os perfis existentes.
 */
export const getPxSalesAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PxSalesAccess> => {
    const { supabase, userId } = context as any;

    const [{ data: allowed }, { data: isExec }] = await Promise.all([
      supabase.rpc("has_system_access", { _user_id: userId, _sistema: PXSALES_SISTEMA_KEY }),
      supabase.rpc("is_executive", { _user_id: userId }),
    ]);

    if (!allowed) return { allowed: false, isAdmin: false, permissoes: [] };

    if (isExec) {
      return { allowed: true, isAdmin: true, permissoes: [...PXSALES_PERMISSION_ACTIONS] };
    }

    const { data: perfis } = await supabase
      .from("px_usuario_perfis")
      .select("perfil_id")
      .eq("user_id", userId);

    const perfilIds = (perfis ?? []).map((p: any) => p.perfil_id);
    if (!perfilIds.length) return { allowed: true, isAdmin: false, permissoes: [] };

    const { data: perms } = await supabase
      .from("px_perfil_permissoes")
      .select("acao")
      .eq("sistema_key", PXSALES_SISTEMA_KEY)
      .in("perfil_id", perfilIds);

    const permissoes = Array.from(new Set((perms ?? []).map((p: any) => p.acao as string)));
    return {
      allowed: true,
      isAdmin: permissoes.includes("pxsales.settings.manage"),
      permissoes,
    };
  });

/** Marca o último acesso do usuário ao PXSales (quando o vínculo existir). */
export const touchPxSalesAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await supabase
      .from("px_usuario_sistemas")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("sistema_key", PXSALES_SISTEMA_KEY);
    return { ok: true };
  });
