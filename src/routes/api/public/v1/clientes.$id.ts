// PX API — GET /api/public/v1/clientes/:id
// Detalhe de um cliente, opcionalmente com endereços/contatos.
//
// Query params:
//   include=enderecos,contatos
//
// Requer escopo: clientes:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

const SAFE_COLUMNS = `
  id, cnpj, razao_social, nome_fantasia, situacao_cadastral, natureza_juridica,
  cnae_principal, cnae_descricao, data_abertura,
  cep, logradouro, numero, complemento, bairro, cidade, uf,
  contato_nome, contato_cargo, telefone, whatsapp, email,
  observacoes, categorias, ativo, created_at, updated_at
`;

export const Route = createFileRoute("/api/public/v1/clientes/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const id = params.id;
          const include = (new URL(request.url).searchParams.get("include") ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean);

          const { data: cliente, error } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .select(SAFE_COLUMNS)
            .eq("id", id)
            .maybeSingle();
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar cliente.", {
              requestId: ctx.requestId, details: error.message,
            });
          }
          if (!cliente) {
            return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });
          }

          const extras: Record<string, unknown> = {};
          if (include.includes("enderecos")) {
            const { data } = await (ctx.supabase as any)
              .from("px_registry_enderecos")
              .select("*")
              .eq("cliente_id", id)
              .order("is_padrao_remetente", { ascending: false });
            extras.enderecos = data ?? [];
          }
          if (include.includes("contatos")) {
            const { data } = await (ctx.supabase as any)
              .from("px_registry_contatos")
              .select("*")
              .eq("cliente_id", id)
              .order("is_principal", { ascending: false });
            extras.contatos = data ?? [];
          }

          return pxOk({ ...cliente, ...extras }, { requestId: ctx.requestId });
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
