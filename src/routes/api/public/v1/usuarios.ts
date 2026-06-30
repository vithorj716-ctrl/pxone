// PX API — GET /api/public/v1/usuarios
// Lista usuários (meta: nome, login, cargo, situação, empresa).
//
// Query params: page, pageSize, search, situacao=ativo|inativo, empresa_id
// Requer escopo: usuarios:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

export const Route = createFileRoute("/api/public/v1/usuarios")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["usuarios:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 50, maxSize: 200 });
          const search = url.searchParams.get("search")?.trim() || "";
          const situacao = url.searchParams.get("situacao")?.trim() || "";
          const empresaId = url.searchParams.get("empresa_id")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_usuarios_meta")
            .select("user_id, nome, login, cargo, situacao, empresa_id, observacoes, created_at, updated_at", { count: "exact" })
            .order("nome", { ascending: true })
            .range(from, to);

          if (search) {
            const s = search.replace(/[%_]/g, "");
            q = q.or([`nome.ilike.%${s}%`, `login.ilike.%${s}%`, `cargo.ilike.%${s}%`].join(","));
          }
          if (situacao) q = q.eq("situacao", situacao);
          if (empresaId) q = q.eq("empresa_id", empresaId);

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar usuários.", {
              requestId: ctx.requestId, details: error.message,
            });
          }
          return pxOk(
            { items: data ?? [], meta: makeMeta(page, pageSize, count ?? 0) },
            { requestId: ctx.requestId },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
