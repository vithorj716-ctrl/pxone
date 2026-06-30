// PX API — GET /api/public/v1/perfis
// Lista perfis de acesso da plataforma, opcionalmente com permissões.
//
// Query params: include=permissoes
// Requer escopo: perfis:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/perfis")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["perfis:read"] }, async (ctx) => {
          const include = (new URL(request.url).searchParams.get("include") ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean);

          const { data: perfis, error } = await (ctx.supabase as any)
            .from("px_perfis")
            .select("*")
            .order("nome", { ascending: true });
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar perfis.", {
              requestId: ctx.requestId, details: error.message,
            });
          }

          let result: any[] = perfis ?? [];
          if (include.includes("permissoes") && result.length > 0) {
            const ids = result.map((p) => p.id);
            const { data: perms } = await (ctx.supabase as any)
              .from("px_perfil_permissoes")
              .select("*")
              .in("perfil_id", ids);
            const byPerfil = new Map<string, any[]>();
            for (const p of perms ?? []) {
              const arr = byPerfil.get(p.perfil_id) ?? [];
              arr.push(p);
              byPerfil.set(p.perfil_id, arr);
            }
            result = result.map((p) => ({ ...p, permissoes: byPerfil.get(p.id) ?? [] }));
          }

          return pxOk({ items: result }, { requestId: ctx.requestId });
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
