// PX API — /api/public/v1/clientes
// GET  — lista paginada (clientes:read)
// POST — cria cliente (clientes:write, idempotente por Idempotency-Key + CNPJ único)

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";
import { readJson, normalizeCnpj, require_, pick, uf2 } from "@/px-api/validation";
import { lookupIdempotency, saveIdempotency, sha256Hex } from "@/px-api/idempotency";

const SAFE_COLUMNS = [
  "id", "cnpj", "razao_social", "nome_fantasia", "situacao_cadastral",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "telefone", "email", "categorias", "ativo", "created_at", "updated_at",
].join(", ");

const CLIENTE_INSERT_FIELDS = [
  "cnpj", "razao_social", "nome_fantasia", "situacao_cadastral", "natureza_juridica",
  "cnae_principal", "cnae_descricao", "data_abertura",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "contato_nome", "contato_cargo", "telefone", "whatsapp", "email",
  "observacoes", "observacoes_comerciais", "categorias",
  "limite_credito", "prazo_padrao_dias", "condicao_pagamento", "tabela_frete_id",
] as const;

export const Route = createFileRoute("/api/public/v1/clientes")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 25, maxSize: 100 });
          const search = url.searchParams.get("search")?.trim() || "";
          const categoria = url.searchParams.get("categoria")?.trim() || "";
          const ativoParam = url.searchParams.get("ativo");

          let q = (ctx.supabase as any)
            .from("px_registry_clientes")
            .select(SAFE_COLUMNS, { count: "exact" })
            .order("razao_social", { ascending: true })
            .range(from, to);

          if (search) {
            const s = search.replace(/[%_]/g, "");
            const digits = s.replace(/\D/g, "");
            const ors = [`razao_social.ilike.%${s}%`, `nome_fantasia.ilike.%${s}%`];
            if (digits.length >= 3) ors.push(`cnpj.ilike.%${digits}%`);
            q = q.or(ors.join(","));
          }
          if (categoria) q = q.contains("categorias", [categoria]);
          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar clientes.", {
              requestId: ctx.requestId, details: error.message,
            });
          }
          return pxOk(
            { items: data ?? [], meta: makeMeta(page, pageSize, count ?? 0) },
            { requestId: ctx.requestId },
          );
        }),

      POST: async ({ request }) =>
        withPxApi(request, { scopes: ["clientes:write"] }, async (ctx) => {
          const parsed = await readJson(request);
          if (!parsed.ok) return parsed.response;
          const body = parsed.body;

          const cnpj = normalizeCnpj(body.cnpj);
          if (!cnpj) return pxErr("VALIDATION_ERROR", "CNPJ inválido.", { requestId: ctx.requestId });

          const missing = require_({ ...body, cnpj }, ["cnpj", "razao_social"]);
          if (missing) return pxErr("VALIDATION_ERROR", missing, { requestId: ctx.requestId });

          // Idempotência
          const idemKey = request.headers.get("idempotency-key")?.trim();
          const endpoint = new URL(request.url).pathname;
          const reqHash = await sha256Hex(JSON.stringify({ cnpj, ...pick(body, CLIENTE_INSERT_FIELDS as any) }));
          if (idemKey) {
            const hit = await lookupIdempotency(ctx.supabase, {
              apiClientId: ctx.client.id, key: idemKey, endpoint, method: "POST", requestHash: reqHash,
            });
            if (hit) {
              if (hit.status === 409) {
                return pxErr("CONFLICT", "Idempotency-Key reutilizada com body diferente.", { requestId: ctx.requestId });
              }
              return new Response(JSON.stringify(hit.body), {
                status: hit.status,
                headers: { "content-type": "application/json; charset=utf-8", "x-request-id": ctx.requestId, "idempotent-replay": "true" },
              });
            }
          }

          // CNPJ único — se existir e estiver ativo, devolve o registro existente (idempotência natural).
          const { data: existing } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .select(SAFE_COLUMNS)
            .eq("cnpj", cnpj)
            .maybeSingle();
          if (existing) {
            const body409 = {
              status: "ok", message: "Cliente já existente para esse CNPJ.",
              data: existing, timestamp: new Date().toISOString(), requestId: ctx.requestId,
            };
            if (idemKey) {
              await saveIdempotency(ctx.supabase, {
                apiClientId: ctx.client.id, key: idemKey, endpoint, method: "POST",
                requestHash: reqHash, responseStatus: 200, responseBody: body409,
              });
            }
            return pxOk(existing, { message: "Cliente já existente para esse CNPJ.", requestId: ctx.requestId });
          }

          const insert: any = { cnpj, ...pick(body, CLIENTE_INSERT_FIELDS as any) };
          if (insert.uf) {
            const u = uf2(insert.uf);
            if (!u) return pxErr("VALIDATION_ERROR", "UF inválida.", { requestId: ctx.requestId });
            insert.uf = u;
          }
          insert.api_payload = { source: ctx.client.sistema_key, raw: body };

          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_clientes")
            .insert(insert)
            .select(SAFE_COLUMNS)
            .single();
          if (error) {
            return pxErr("INTERNAL", "Falha ao criar cliente.", {
              requestId: ctx.requestId, details: error.message,
            });
          }

          const okBody = {
            status: "ok", message: "Cliente criado.", data,
            timestamp: new Date().toISOString(), requestId: ctx.requestId,
          };
          if (idemKey) {
            await saveIdempotency(ctx.supabase, {
              apiClientId: ctx.client.id, key: idemKey, endpoint, method: "POST",
              requestHash: reqHash, responseStatus: 201, responseBody: okBody,
            });
          }
          return pxOk(data, { message: "Cliente criado.", requestId: ctx.requestId, status: 201 });
        }),
    },
  },
});
