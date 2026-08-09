// Administração de usuários da plataforma — apenas executivos (master_admin/socio/diretor).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const APP_ROLES = ["master_admin", "socio", "diretor", "gestor", "consultor", "auditor"] as const;
export type AppRole = (typeof APP_ROLES)[number];

async function assertExecutivo(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("is_executive", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem gerenciar usuários.");
}

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertExecutivo(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: metas } = await supabaseAdmin
      .from("px_usuarios_meta")
      .select("user_id, nome, login, cargo, situacao");

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const metaByUser = new Map((metas ?? []).map((m: any) => [m.user_id, m]));

    return list.users.map((u) => {
      const meta: any = metaByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        login: meta?.login ?? (u.email ?? "").split("@")[0],
        nome: meta?.nome ?? null,
        cargo: meta?.cargo ?? null,
        situacao: meta?.situacao ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        roles: rolesByUser.get(u.id) ?? [],
      };
    });
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; roles: string[] }) => {
    if (!d?.userId) throw new Error("userId obrigatório");
    const roles = (d.roles ?? []).filter((r) => (APP_ROLES as readonly string[]).includes(r));
    return { userId: d.userId, roles };
  })
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    if (data.userId === context.userId && !data.roles.includes("master_admin")) {
      throw new Error("Você não pode remover o seu próprio acesso de administrador total.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.roles.length > 0) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: data.userId, role: role as AppRole })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => {
    if (!d?.userId) throw new Error("userId obrigatório");
    if (!d?.password || d.password.length < 8) throw new Error("Senha deve ter ao menos 8 caracteres.");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
