// PX API — GET /api/public/v1/clientes/:id/conta-corrente
// Retorna saldo, limite, utilizado, vencido e situação de bloqueio.
// Requer escopo: financeiro:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/clientes/$id/conta-corrente")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["financeiro:read"] }, async (ctx) => {
          const cliente_id = params.id;
          const [{ data: saldo }, { data: credito }] = await Promise.all([
            (ctx.supabase as any).from("px_cliente_saldo").select("*").eq("cliente_id", cliente_id).maybeSingle(),
            (ctx.supabase as any).from("px_cliente_credito").select("*").eq("cliente_id", cliente_id).maybeSingle(),
          ]);
          if (!saldo && !credito) {
            return pxErr("NOT_FOUND", "Conta corrente não encontrada para este cliente.", { requestId: ctx.requestId });
          }
          const limite = saldo?.limite_credito ?? credito?.limite_credito ?? 0;
          const utilizado = saldo?.utilizado ?? 0;
          const vencido = saldo?.vencido ?? 0;
          const disponivel = saldo?.disponivel ?? Math.max(0, limite - utilizado);
          const bloqueado = !!(saldo?.bloqueado ?? credito?.bloqueado);
          const situacao = bloqueado ? "bloqueado" : vencido > 0 ? "vencido" : utilizado > limite ? "estourado" : "ok";

          return pxOk(
            {
              cliente_id,
              limite_credito: limite,
              utilizado,
              vencido,
              disponivel,
              bloqueado,
              motivo_bloqueio: saldo?.motivo_bloqueio ?? credito?.motivo_bloqueio ?? null,
              liberado_ate: saldo?.liberado_ate ?? credito?.liberado_ate ?? null,
              situacao,
            },
            { requestId: ctx.requestId },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
