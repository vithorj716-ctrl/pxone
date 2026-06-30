// PX API — GET /api/public/v1/empresas
// Lista as empresas do grupo PX.
//
// Query params: page, pageSize, search, situacao
// Requer escopo: empresas:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

const COLS =
  "id, codigo, nome, nome_fantasia, razao_social, cnpj, segmento, setor, situacao, logo_url, created_at";

export const Route = createFileRoute("/api/public/v1/empresas")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["empresas:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 25, maxSize: 100 });
          const search = url.searchParams.get("search")?.trim() || "";
          const situacao = url.searchParams.get("situacao")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("empresas")
            .select(COLS, { count: "exact" })
            .order("nome", { ascending: true })
            .range(from, to);

          if (search) {
            const s = search.replace(/[%_]/g, "");
            q = q.or(
              [`nome.ilike.%${s}%`, `razao_social.ilike.%${s}%`, `nome_fantasia.ilike.%${s}%`, `codigo.ilike.%${s}%`].join(","),
            );
          }
          if (situacao) q = q.eq("situacao", situacao);

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar empresas.", {
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
