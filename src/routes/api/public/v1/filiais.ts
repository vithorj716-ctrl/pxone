// PX API — GET /api/public/v1/filiais
// Lista filiais (opcionalmente filtradas por empresa).
//
// Query params: page, pageSize, empresa_id, ativo=true|false, search
// Requer escopo: empresas:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

export const Route = createFileRoute("/api/public/v1/filiais")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["empresas:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 50, maxSize: 200 });
          const empresaId = url.searchParams.get("empresa_id")?.trim() || "";
          const ativoParam = url.searchParams.get("ativo");
          const search = url.searchParams.get("search")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_filiais")
            .select("*", { count: "exact" })
            .order("nome", { ascending: true })
            .range(from, to);

          if (empresaId) q = q.eq("empresa_id", empresaId);
          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);
          if (search) {
            const s = search.replace(/[%_]/g, "");
            q = q.or([`nome.ilike.%${s}%`, `cidade.ilike.%${s}%`, `cnpj.ilike.%${s}%`].join(","));
          }

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar filiais.", {
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
