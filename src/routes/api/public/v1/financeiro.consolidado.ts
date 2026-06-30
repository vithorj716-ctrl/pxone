// PX API — GET /api/public/v1/financeiro/consolidado
// Consolidação financeira agregada (somente leitura) para o ecossistema PX.
//
// Query: de=YYYY-MM-DD, ate=YYYY-MM-DD, cliente_id?, origem?
// Requer escopo: financeiro:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/financeiro/consolidado")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["financeiro:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const de = url.searchParams.get("de")?.trim() || "";
          const ate = url.searchParams.get("ate")?.trim() || "";
          const cliente_id = url.searchParams.get("cliente_id")?.trim() || "";
          const origem = url.searchParams.get("origem")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("px_cliente_lancamentos")
            .select("tipo, status, valor, origem, emissao, cliente_id")
            .limit(10000);
          if (de) q = q.gte("emissao", de);
          if (ate) q = q.lte("emissao", ate);
          if (cliente_id) q = q.eq("cliente_id", cliente_id);
          if (origem) q = q.eq("origem", origem);

          const { data, error } = await q;
          if (error) return pxErr("INTERNAL", "Falha ao consolidar.", { requestId: ctx.requestId, details: error.message });

          const rows = (data ?? []) as Array<{ tipo: string; status: string; valor: number; origem: string | null }>;
          const sum = (pred: (r: typeof rows[number]) => boolean) =>
            rows.filter(pred).reduce((a, b) => a + Number(b.valor || 0), 0);

          const a_receber = sum((r) => r.tipo === "credito" && r.status === "aberto");
          const recebido = sum((r) => r.tipo === "credito" && r.status === "pago");
          const inadimplencia = sum((r) => r.tipo === "credito" && r.status === "aberto");
          const receita_realizada = sum((r) => r.tipo === "credito" && r.status === "pago");
          const receita_prevista = sum((r) => r.tipo === "credito");

          const por_origem: Record<string, number> = {};
          for (const r of rows) {
            if (r.tipo !== "credito") continue;
            const k = r.origem ?? "manual";
            por_origem[k] = (por_origem[k] ?? 0) + Number(r.valor || 0);
          }

          return pxOk(
            {
              periodo: { de: de || null, ate: ate || null },
              totais: { a_receber, recebido, inadimplencia, receita_prevista, receita_realizada },
              por_origem,
              total_registros: rows.length,
            },
            { requestId: ctx.requestId, message: "Consolidado financeiro" },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
