// PX API — GET /api/public/v1/clientes/:id/enderecos
// Lista todos os endereços de um cliente.
//
// Requer escopo: clientes:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/clientes/$id/enderecos")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const ativoParam = url.searchParams.get("ativo");
          const tipo = url.searchParams.get("tipo")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_registry_enderecos")
            .select("*")
            .eq("cliente_id", params.id)
            .order("is_padrao_remetente", { ascending: false })
            .order("created_at", { ascending: true });

          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);
          if (tipo) q = q.eq("tipo", tipo);

          const { data, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar endereços.", {
              requestId: ctx.requestId,
              details: error.message,
            });
          }
          return pxOk({ items: data ?? [] }, { requestId: ctx.requestId });
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
