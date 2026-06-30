// PX API — POST /api/public/v1/financeiro/lancamentos
// Recebe faturamento operacional do PXLog (TMS) e materializa um lançamento
// financeiro em px_cliente_lancamentos. Idempotente por (sistema_origem, evento, external_id).
//
// Body:
//   {
//     external_id: string,            // id idempotência (ex.: operacao_id do TMS)
//     cliente_id: string,             // UUID do cliente no PX Registry
//     valor: number,                  // valor a receber em BRL
//     descricao?: string,
//     emissao?: string (YYYY-MM-DD),
//     vencimento?: string (YYYY-MM-DD),
//     origem_tipo?: string,           // ex.: 'operacao' | 'minuta'
//     origem_id?: string,             // id da origem no sistema emissor
//     metadata?: object
//   }
//
// Requer escopo: financeiro:write

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { sha256Hex, lookupIdempotency, saveIdempotency } from "@/px-api/idempotency";

export const Route = createFileRoute("/api/public/v1/financeiro/lancamentos")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withPxApi(request, { scopes: ["financeiro:write"] }, async (ctx) => {
          let body: any;
          try { body = await request.json(); } catch {
            return pxErr("VALIDATION_ERROR", "JSON inválido.", { requestId: ctx.requestId });
          }
          const external_id = String(body?.external_id ?? "").trim();
          const cliente_id = String(body?.cliente_id ?? "").trim();
          const valor = Number(body?.valor);
          if (!external_id) return pxErr("VALIDATION_ERROR", "external_id é obrigatório.", { requestId: ctx.requestId });
          if (!cliente_id) return pxErr("VALIDATION_ERROR", "cliente_id é obrigatório.", { requestId: ctx.requestId });
          if (!Number.isFinite(valor) || valor <= 0) {
            return pxErr("VALIDATION_ERROR", "valor deve ser numérico e positivo.", { requestId: ctx.requestId });
          }

          const sistema_origem = ctx.client.sistema_key;
          const evento = "faturamento.criado";
          const idemKey = request.headers.get("idempotency-key") ?? `${sistema_origem}:${external_id}`;
          const endpoint = "/api/public/v1/financeiro/lancamentos";
          const rawBody = JSON.stringify(body);
          const reqHash = await sha256Hex(rawBody);

          const hit = await lookupIdempotency(ctx.supabase, {
            apiClientId: ctx.client.id, key: idemKey, endpoint, method: "POST", requestHash: reqHash,
          });
          if (hit) {
            if (hit.status === 409) {
              return pxErr("CONFLICT", "Idempotency-Key reutilizada com body diferente.", { requestId: ctx.requestId });
            }
            return new Response(JSON.stringify(hit.body), {
              status: hit.status,
              headers: { "content-type": "application/json; charset=utf-8", "idempotent-replay": "true", "x-request-id": ctx.requestId },
            });
          }

          // Verifica cliente
          const { data: cli, error: cliErr } = await (ctx.supabase as any)
            .from("px_registry_clientes").select("id, ativo").eq("id", cliente_id).maybeSingle();
          if (cliErr) return pxErr("INTERNAL", "Falha ao validar cliente.", { requestId: ctx.requestId, details: cliErr.message });
          if (!cli) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });

          // Registra inbox (auditoria/replay)
          const inboxIns = await (ctx.supabase as any).from("px_integration_inbox").insert({
            sistema_origem, evento, external_id, payload: body, status: "recebido",
          }).select("id").maybeSingle();

          // Cria lançamento (a receber → crédito)
          const ins = await (ctx.supabase as any).from("px_cliente_lancamentos").insert({
            cliente_id,
            tipo: "credito",
            status: "aberto",
            valor,
            descricao: body?.descricao ?? `Faturamento ${sistema_origem.toUpperCase()} (${external_id})`,
            emissao: body?.emissao ?? new Date().toISOString().slice(0, 10),
            vencimento: body?.vencimento ?? null,
            origem: sistema_origem,
            origem_id: body?.origem_id ?? external_id,
            metadata: body?.metadata ?? {},
          }).select("*").maybeSingle();

          if (ins.error) {
            await (ctx.supabase as any).from("px_integration_inbox")
              .update({ status: "erro", erro: ins.error.message })
              .eq("id", inboxIns?.data?.id ?? "00000000-0000-0000-0000-000000000000");
            return pxErr("INTERNAL", "Falha ao criar lançamento.", { requestId: ctx.requestId, details: ins.error.message });
          }

          // Vínculo lógico operação ↔ lançamento
          if (body?.origem_id) {
            await (ctx.supabase as any).from("px_integration_links").insert({
              sistema_origem,
              tipo_origem: body?.origem_tipo ?? "operacao",
              id_origem: String(body.origem_id),
              sistema_destino: "pxone",
              tipo_destino: "lancamento",
              id_destino: String(ins.data.id),
              metadata: { external_id },
            }).select("id");
          }

          await (ctx.supabase as any).from("px_integration_inbox")
            .update({ status: "processado", processed_at: new Date().toISOString() })
            .eq("id", inboxIns?.data?.id ?? "00000000-0000-0000-0000-000000000000");

          const responseBody = {
            status: "ok", message: "Lançamento criado", data: ins.data,
            timestamp: new Date().toISOString(), requestId: ctx.requestId,
          };
          await saveIdempotency(ctx.supabase, {
            apiClientId: ctx.client.id, key: idemKey, endpoint, method: "POST",
            requestHash: reqHash, responseStatus: 201, responseBody,
          });
          return new Response(JSON.stringify(responseBody), {
            status: 201,
            headers: { "content-type": "application/json; charset=utf-8", "x-request-id": ctx.requestId },
          });
        }),
      GET: async ({ request }) => methodNotAllowed(["POST"], getRequestId(request)),
    },
  },
});
