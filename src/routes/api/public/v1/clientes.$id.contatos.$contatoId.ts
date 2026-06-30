// PX API — /api/public/v1/clientes/:id/contatos/:contatoId
// GET    — detalhe (clientes:read)
// PATCH  — atualização parcial (contatos:write)
// DELETE — remoção definitiva (contatos:write)

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { readJson, pick } from "@/px-api/validation";

const PATCH_FIELDS = [
  "nome", "cargo", "setor", "email", "telefone", "whatsapp",
  "endereco_id", "is_principal", "observacoes",
] as const;

export const Route = createFileRoute("/api/public/v1/clientes/$id/contatos/$contatoId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_contatos").select("*")
            .eq("cliente_id", params.id).eq("id", params.contatoId).maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao consultar contato.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Contato não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { requestId: ctx.requestId });
        }),

      PATCH: async ({ request, params }) =>
        withPxApi(request, { scopes: ["contatos:write"] }, async (ctx) => {
          const parsed = await readJson(request);
          if (!parsed.ok) return parsed.response;
          const patch: any = pick(parsed.body, PATCH_FIELDS as any);
          if (Object.keys(patch).length === 0) {
            return pxErr("VALIDATION_ERROR", "Nenhum campo válido para atualizar.", { requestId: ctx.requestId });
          }
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_contatos").update(patch)
            .eq("cliente_id", params.id).eq("id", params.contatoId)
            .select("*").maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao atualizar contato.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Contato não encontrado.", { requestId: ctx.requestId });
          return pxOk(data, { message: "Contato atualizado.", requestId: ctx.requestId });
        }),

      DELETE: async ({ request, params }) =>
        withPxApi(request, { scopes: ["contatos:write"] }, async (ctx) => {
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_contatos").delete()
            .eq("cliente_id", params.id).eq("id", params.contatoId)
            .select("id").maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao remover contato.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Contato não encontrado.", { requestId: ctx.requestId });
          return pxOk({ id: data.id, deleted: true }, { message: "Contato removido.", requestId: ctx.requestId });
        }),
    },
  },
});
