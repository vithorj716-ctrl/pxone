// PX API — /api/public/v1/clientes/:id
// GET   — detalhe (com ?include=enderecos,contatos) — clientes:read
// PATCH — atualização parcial — clientes:write

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { readJson, pick, uf2 } from "@/px-api/validation";

const SAFE_COLUMNS = `
  id, cnpj, razao_social, nome_fantasia, situacao_cadastral, natureza_juridica,
  cnae_principal, cnae_descricao, data_abertura,
  cep, logradouro, numero, complemento, bairro, cidade, uf,
  contato_nome, contato_cargo, telefone, whatsapp, email,
  observacoes, observacoes_comerciais, categorias,
  limite_credito, prazo_padrao_dias, condicao_pagamento, tabela_frete_id,
  ativo, created_at, updated_at
`;

const PATCH_FIELDS = [
  "razao_social", "nome_fantasia", "situacao_cadastral", "natureza_juridica",
  "cnae_principal", "cnae_descricao", "data_abertura",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "contato_nome", "contato_cargo", "telefone", "whatsapp", "email",
  "observacoes", "observacoes_comerciais", "categorias",
  "limite_credito", "prazo_padrao_dias", "condicao_pagamento", "tabela_frete_id",
] as const;

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
          if (error) return pxErr("INTERNAL", "Falha ao consultar cliente.", { requestId: ctx.requestId, details: error.message });
          if (!cliente) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });

          const extras: Record<string, unknown> = {};
          if (include.includes("enderecos")) {
            const { data } = await (ctx.supabase as any)
              .from("px_registry_enderecos").select("*").eq("cliente_id", id)
              .order("is_padrao_remetente", { ascending: false });
            extras.enderecos = data ?? [];
          }
          if (include.includes("contatos")) {
            const { data } = await (ctx.supabase as any)
              .from("px_registry_contatos").select("*").eq("cliente_id", id)
              .order("is_principal", { ascending: false });
            extras.contatos = data ?? [];
          }

          return pxOk({ ...cliente, ...extras }, { requestId: ctx.requestId });
        }),

      PATCH: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:write"] }, async (ctx) => {
          const parsed = await readJson(request);
          if (!parsed.ok) return parsed.response;
          const patch: any = pick(parsed.body, PATCH_FIELDS as any);
          if (Object.keys(patch).length === 0) {
            return pxErr("VALIDATION_ERROR", "Nenhum campo válido para atualizar.", { requestId: ctx.requestId });
          }
          if (patch.uf !== undefined) {
            const u = uf2(patch.uf);
            if (!u) return pxErr("VALIDATION_ERROR", "UF inválida.", { requestId: ctx.requestId });
            patch.uf = u;
          }

          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .update(patch)
            .eq("id", params.id)
            .select(SAFE_COLUMNS)
            .maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao atualizar cliente.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { message: "Cliente atualizado.", requestId: ctx.requestId });
        }),

      POST: async ({ request }) => methodNotAllowed(["GET", "PATCH"], getRequestId(request)),
    },
  },
});
