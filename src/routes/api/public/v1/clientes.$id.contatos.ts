// PX API — GET /api/public/v1/clientes/:id/contatos
// Lista todos os contatos de um cliente.
//
// Requer escopo: clientes:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/clientes/$id/contatos")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const setor = url.searchParams.get("setor")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_registry_contatos")
            .select("*")
            .eq("cliente_id", params.id)
            .order("is_principal", { ascending: false })
            .order("nome", { ascending: true });

          if (setor) q = q.eq("setor", setor);

          const { data, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar contatos.", {
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
