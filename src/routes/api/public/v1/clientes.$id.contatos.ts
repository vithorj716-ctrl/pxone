// PX API — /api/public/v1/clientes/:id/contatos
// GET  — lista contatos (clientes:read)
// POST — cria contato (contatos:write)

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { readJson, pick, require_ } from "@/px-api/validation";

const CONTATO_FIELDS = [
  "nome", "cargo", "setor", "email", "telefone", "whatsapp",
  "endereco_id", "is_principal", "observacoes",
] as const;

export const Route = createFileRoute("/api/public/v1/clientes/$id/contatos")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const setor = url.searchParams.get("setor")?.trim() || "";
          let q = (ctx.supabase as any)
            .from("px_registry_contatos").select("*")
            .eq("cliente_id", params.id)
            .order("is_principal", { ascending: false })
            .order("nome", { ascending: true });
          if (setor) q = q.eq("setor", setor);
          const { data, error } = await q;
          if (error) return pxErr("INTERNAL", "Falha ao consultar contatos.", { requestId: ctx.requestId, details: error.message });
          return pxOk({ items: data ?? [] }, { requestId: ctx.requestId });
        }),

      POST: async ({ request, params }) =>
        withPxApi(request, { scopes: ["contatos:write"] }, async (ctx) => {
          const parsed = await readJson(request);
          if (!parsed.ok) return parsed.response;

          const missing = require_(parsed.body, ["nome"]);
          if (missing) return pxErr("VALIDATION_ERROR", missing, { requestId: ctx.requestId });

          const insert: any = pick(parsed.body, CONTATO_FIELDS as any);
          insert.cliente_id = params.id;

          const { data: cli } = await (ctx.supabase as any)
            .from("px_registry_clientes").select("id").eq("id", params.id).maybeSingle();
          if (!cli) return pxErr("NOT_FOUND", "Cliente não encontrado.", { requestId: ctx.requestId });

          const { data, error } = await (ctx.supabase as any)
            .from("px_registry_contatos").insert(insert).select("*").single();
          if (error) return pxErr("INTERNAL", "Falha ao criar contato.", { requestId: ctx.requestId, details: error.message });
          return pxOk(data, { message: "Contato criado.", requestId: ctx.requestId, status: 201 });
        }),
    },
  },
});
