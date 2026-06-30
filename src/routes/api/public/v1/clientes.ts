// PX API — GET /api/public/v1/clientes
// Lista paginada de clientes cadastrados no PXOne.
//
// Query params:
//   page=1
//   pageSize=25 (max 100)
//   search=<razao_social|nome_fantasia|cnpj>
//   categoria=<slug>
//   ativo=true|false
//
// Requer escopo: clientes:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

const SAFE_COLUMNS = [
  "id",
  "cnpj",
  "razao_social",
  "nome_fantasia",
  "situacao_cadastral",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "telefone",
  "email",
  "categorias",
  "ativo",
  "created_at",
  "updated_at",
].join(", ");

export const Route = createFileRoute("/api/public/v1/clientes")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 25, maxSize: 100 });
          const search = url.searchParams.get("search")?.trim() || "";
          const categoria = url.searchParams.get("categoria")?.trim() || "";
          const ativoParam = url.searchParams.get("ativo");

          let q = (ctx.supabase as any)
            .from("px_registry_clientes")
            .select(SAFE_COLUMNS, { count: "exact" })
            .order("razao_social", { ascending: true })
            .range(from, to);

          if (search) {
            const s = search.replace(/[%_]/g, "");
            const digits = s.replace(/\D/g, "");
            const ors = [`razao_social.ilike.%${s}%`, `nome_fantasia.ilike.%${s}%`];
            if (digits.length >= 3) ors.push(`cnpj.ilike.%${digits}%`);
            q = q.or(ors.join(","));
          }
          if (categoria) q = q.contains("categorias", [categoria]);
          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar clientes.", {
              requestId: ctx.requestId,
              details: error.message,
            });
          }

          return pxOk(
            {
              items: data ?? [],
              meta: makeMeta(page, pageSize, count ?? 0),
            },
            { requestId: ctx.requestId },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
