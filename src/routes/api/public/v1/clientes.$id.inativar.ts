// PX API — POST /api/public/v1/clientes/:id/inativar
// Inativa um cliente (escopo clientes:write).
// Body opcional: { motivo: string }

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/clientes/$id/inativar")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:write"] }, async (ctx) => {
          let motivo: string | null = null;
          try {
            const j = await request.json();
            if (j && typeof j === "object" && typeof j.motivo === "string") motivo = j.motivo.trim() || null;
          } catch { /* body opcional */ }

          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .update({
              ativo: false,
              inativado_em: new Date().toISOString(),
              motivo_inativacao: motivo,
            })
            .eq("id", params.id)
            .select("id, cnpj, razao_social, ativo, inativado_em, motivo_inativacao")
            .maybeSingle();
          if (error) return pxErr("INTERNAL", "Falha ao inativar cliente.", { requestId: ctx.requestId, details: error.message });
          if (!data) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });
          await (ctx.supabase as any)
            .from("tms_clientes")
            .update({ ativo: false })
            .eq("registry_id", data.id);
          return pxOk(data, { message: "Cliente inativado.", requestId: ctx.requestId });
        }),
      GET: async ({ request }) => methodNotAllowed(["POST"], getRequestId(request)),
    },
  },
});
