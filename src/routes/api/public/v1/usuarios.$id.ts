// PX API — GET /api/public/v1/usuarios/:id
// Detalhe de usuário, com perfis e sistemas habilitados.
//
// Query params: include=perfis,sistemas
// Requer escopo: usuarios:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/usuarios/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["usuarios:read"] }, async (ctx) => {
          const include = (new URL(request.url).searchParams.get("include") ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean);

          const { data: meta, error } = await (ctx.supabase as any)
            .from("px_usuarios_meta")
            .select("user_id, nome, login, cargo, situacao, empresa_id, observacoes, created_at, updated_at")
            .eq("user_id", params.id)
            .maybeSingle();
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar usuário.", {
              requestId: ctx.requestId, details: error.message,
            });
          }
          if (!meta) {
            return pxErr("NOT_FOUND", "Usuário não encontrado.", { requestId: ctx.requestId });
          }

          const extras: Record<string, unknown> = {};
          if (include.includes("perfis")) {
            const { data } = await (ctx.supabase as any)
              .from("px_usuario_perfis")
              .select("perfil_id, created_at, px_perfis(id, nome, descricao, is_system)")
              .eq("user_id", params.id);
            extras.perfis = data ?? [];
          }
          if (include.includes("sistemas")) {
            const { data } = await (ctx.supabase as any)
              .from("px_usuario_sistemas")
              .select("sistema_key, ativo, ultimo_acesso, created_at, updated_at")
              .eq("user_id", params.id);
            extras.sistemas = data ?? [];
          }

          return pxOk({ ...meta, ...extras }, { requestId: ctx.requestId });
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
