// PX API — POST /api/public/v1/clientes/:id/reativar
// Reativa um cliente previamente inativado (escopo clientes:write).

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/clientes/$id/reativar")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:write"] }, async (ctx) => {
          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .update({ ativo: true, inativado_em: null, motivo_inativacao: null })
            .eq("id", params.id)
            .select("id, cnpj, razao_social, ativo")
            .maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao reativar cliente.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });
          await (ctx.supabase as any)
            .from("px_registry_vinculos")
            .upsert(
              { cliente_id: data.id, sistema_key: "pxlog" },
              { onConflict: "cliente_id,sistema_key", ignoreDuplicates: true },
            );
          await (ctx.supabase as any)
            .from("tms_clientes")
            .update({ ativo: true })
            .eq("registry_id", data.id);
          return pxOk(data, { message: "Cliente reativado.", requestId: ctx.requestId });
        }),
      GET: async ({ request }) => methodNotAllowed(["POST"], getRequestId(request)),
    },
  },
});
