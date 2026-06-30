// PX API — GET /api/public/v1/tabelas-frete
// Lista tabelas de frete cadastradas, opcionalmente filtradas por cliente.
//
// Query params: page, pageSize, cliente_id, ativo=true|false, search,
//   origem=<uf|cidade>, destino=<uf|cidade>
// Requer escopo: tabelas-frete:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

export const Route = createFileRoute("/api/public/v1/tabelas-frete")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["tabelas-frete:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 50, maxSize: 200 });
          const clienteId = url.searchParams.get("cliente_id")?.trim() || "";
          const ativoParam = url.searchParams.get("ativo");
          const origem = url.searchParams.get("origem")?.trim() || "";
          const destino = url.searchParams.get("destino")?.trim() || "";
          const search = url.searchParams.get("search")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("tms_tabela_frete")
            .select("*", { count: "exact" })
            .order("nome", { ascending: true })
            .range(from, to);

          if (clienteId) q = q.eq("cliente_id", clienteId);
          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);
          if (origem) q = q.ilike("origem", `%${origem.replace(/[%_]/g, "")}%`);
          if (destino) q = q.ilike("destino", `%${destino.replace(/[%_]/g, "")}%`);
          if (search) {
            const s = search.replace(/[%_]/g, "");
            q = q.ilike("nome", `%${s}%`);
          }

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar tabelas de frete.", {
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
