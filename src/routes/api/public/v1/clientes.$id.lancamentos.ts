// PX API — GET /api/public/v1/clientes/:id/lancamentos
// Lançamentos da conta corrente do cliente (paginado).
//
// Query params:
//   page, pageSize, tipo=debito|credito, status=aberto|pago|cancelado,
//   origem=<string>, de=YYYY-MM-DD, ate=YYYY-MM-DD
//
// Requer escopo: clientes:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

export const Route = createFileRoute("/api/public/v1/clientes/$id/lancamentos")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 50, maxSize: 200 });
          const tipo = url.searchParams.get("tipo")?.trim() || "";
          const status = url.searchParams.get("status")?.trim() || "";
          const origem = url.searchParams.get("origem")?.trim() || "";
          const de = url.searchParams.get("de")?.trim() || "";
          const ate = url.searchParams.get("ate")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_cliente_lancamentos")
            .select("*", { count: "exact" })
            .eq("cliente_id", params.id)
            .order("emissao", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to);

          if (tipo) q = q.eq("tipo", tipo);
          if (status) q = q.eq("status", status);
          if (origem) q = q.eq("origem", origem);
          if (de) q = q.gte("emissao", de);
          if (ate) q = q.lte("emissao", ate);

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar lançamentos.", {
              requestId: ctx.requestId,
              details: error.message,
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
