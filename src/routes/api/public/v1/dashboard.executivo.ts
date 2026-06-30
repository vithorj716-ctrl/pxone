// PX API — GET /api/public/v1/dashboard/executivo
// Consolida dados internos (financeiro do PXOne) + agregados externos do CRM/TMS
// via SDK de integração. Cada bloco externo tem fallback resiliente:
// se o sistema par estiver indisponível ou em standby, retornamos
// { available: false, reason: "..." } no bloco e o dashboard continua funcionando.
//
// Requer escopo: dashboard:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { crm, tms, PxIntegrationError, getIntegrationStatus } from "@/px-integration";

type ExternalBlock<T> = { available: true; data: T } | { available: false; reason: string; code: string };

async function safe<T>(sistema: "pxcrm" | "pxlog", fn: () => Promise<T>): Promise<ExternalBlock<T>> {
  try {
    const data = await fn();
    return { available: true, data };
  } catch (e) {
    if (e instanceof PxIntegrationError) {
      return { available: false, reason: e.message, code: e.code };
    }
    return { available: false, reason: `Falha ao consultar ${sistema}`, code: "NETWORK" };
  }
}

export const Route = createFileRoute("/api/public/v1/dashboard/executivo")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["dashboard:read"] }, async (ctx) => {
          // 1) Financeiro interno (PXOne)
          const { data: lanc, error } = await (ctx.supabase as any)
            .from("px_cliente_lancamentos")
            .select("tipo, status, valor")
            .limit(10000);
          if (error) {
            return pxErr("INTERNAL", "Falha ao agregar financeiro.", { requestId: ctx.requestId, details: error.message });
          }
          const rows = (lanc ?? []) as Array<{ tipo: string; status: string; valor: number }>;
          const sum = (p: (r: typeof rows[number]) => boolean) =>
            rows.filter(p).reduce((a, b) => a + Number(b.valor || 0), 0);
          const financeiro = {
            a_receber: sum((r) => r.tipo === "credito" && r.status === "aberto"),
            recebido: sum((r) => r.tipo === "credito" && r.status === "pago"),
            receita_prevista: sum((r) => r.tipo === "credito"),
            receita_realizada: sum((r) => r.tipo === "credito" && r.status === "pago"),
          };

          // 2) Blocos externos (paralelo, com fallback)
          const [crmPipeline, tmsKpis] = await Promise.all([
            safe("pxcrm", () => crm.pipelineResumo()),
            safe("pxlog", () => tms.kpisOperacionais()),
          ]);

          return pxOk(
            {
              financeiro,
              crm: crmPipeline,
              tms: tmsKpis,
              integrations: {
                pxcrm: getIntegrationStatus("pxcrm"),
                pxlog: getIntegrationStatus("pxlog"),
              },
            },
            { requestId: ctx.requestId, message: "Dashboard executivo consolidado" },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
