// PX API — /api/public/v1/clientes/:id/enderecos
// GET  — lista endereços (clientes:read)
// POST — cria endereço (enderecos:write)

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { readJson, pick, uf2 } from "@/px-api/validation";

const ENDERECO_FIELDS = [
  "apelido", "tipo",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "ponto_referencia", "janela_recebimento", "restricoes", "observacoes",
  "is_padrao_remetente", "is_padrao_destinatario",
] as const;

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
          if (error) return pxErr("INTERNAL", "Falha ao consultar endereços.", { requestId: ctx.requestId, details: error.message });
          return pxOk({ items: data ?? [] }, { requestId: ctx.requestId });
        }),

      POST: async ({ request, params }) =>
        withPxApi(request, { scopes: ["enderecos:write"] }, async (ctx) => {
          const parsed = await readJson(request);
          if (!parsed.ok) return parsed.response;

          const insert: any = pick(parsed.body, ENDERECO_FIELDS as any);
          insert.cliente_id = params.id;
          if (insert.uf !== undefined) {
            const u = uf2(insert.uf);
            if (!u) return pxErr("VALIDATION_ERROR", "UF inválida.", { requestId: ctx.requestId });
            insert.uf = u;
          }

          // Garante o cliente existe.
          const { data: cli } = await (ctx.supabase as any)
            .from("px_registry_clientes").select("id").eq("id", params.id).maybeSingle();
          if (!cli) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });

          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_enderecos").insert(insert).select("*").single();
          if (error) return pxErr("INTERNAL", "Falha ao criar endereço.", { requestId: ctx.requestId, details: error.message });
          return pxOk(data, { message: "Endereço criado.", requestId: ctx.requestId, status: 201 });
        }),
    },
  },
});
