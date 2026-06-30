// PX API — /api/public/v1/clientes/:id/enderecos/:enderecoId
// GET    — detalhe (clientes:read)
// PATCH  — atualização parcial (enderecos:write)
// DELETE — soft-delete (ativo=false) (enderecos:write)

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { readJson, pick, uf2 } from "@/px-api/validation";

const PATCH_FIELDS = [
  "apelido", "tipo", "ativo",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "ponto_referencia", "janela_recebimento", "restricoes", "observacoes",
  "is_padrao_remetente", "is_padrao_destinatario",
] as const;

export const Route = createFileRoute("/api/public/v1/clientes/$id/enderecos/$enderecoId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_enderecos").select("*")
            .eq("cliente_id", params.id).eq("id", params.enderecoId).maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao consultar endereço.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Endereço não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { requestId: ctx.requestId });
        }),

      PATCH: async ({ request, params }) =>
        withPxApi(request, { scopes: ["enderecos:write"] }, async (ctx) => {
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
            .from("px_registry_enderecos").update(patch)
            .eq("cliente_id", params.id).eq("id", params.enderecoId)
            .select("*").maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao atualizar endereço.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Endereço não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { message: "Endereço atualizado.", requestId: ctx.requestId });
        }),

      DELETE: async ({ request, params }) =>
        withPxApi(request, { scopes: ["enderecos:write"] }, async (ctx) => {
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_enderecos").update({ ativo: false })
            .eq("cliente_id", params.id).eq("id", params.enderecoId)
            .select("id, ativo").maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao inativar endereço.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Endereço não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { message: "Endereço inativado.", requestId: ctx.requestId });
        }),
    },
  },
});
