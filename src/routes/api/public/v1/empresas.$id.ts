// PX API — GET /api/public/v1/empresas/:id
// Detalhe da empresa, com opção include=filiais,modulos.
//
// Requer escopo: empresas:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

const COLS =
  "id, codigo, nome, nome_fantasia, razao_social, cnpj, segmento, setor, situacao, logo_url, cor_primaria, cor_secundaria, cor_tema, created_at";

export const Route = createFileRoute("/api/public/v1/empresas/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withPxApi(request, { scopes: ["empresas:read"] }, async (ctx) => {
          const include = (new URL(request.url).searchParams.get("include") ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean);

          const { data: empresa, error } = await (ctx.supabase as any)
            .from("empresas")
            .select(COLS)
            .eq("id", params.id)
            .maybeSingle();
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar empresa.", {
              requestId: ctx.requestId, details: error.message,
            });
          }
          if (!empresa) {
            return pxErr("NOT_FOUND", "Empresa não encontrada.", { requestId: ctx.requestId });
          }

          const extras: Record<string, unknown> = {};
          if (include.includes("filiais")) {
            const { data } = await (ctx.supabase as any)
              .from("px_filiais").select("*").eq("empresa_id", params.id).order("nome");
            extras.filiais = data ?? [];
          }
          if (include.includes("modulos")) {
            const { data } = await (ctx.supabase as any)
              .from("px_empresa_modulos").select("*").eq("empresa_id", params.id);
            extras.modulos = data ?? [];
          }

          return pxOk({ ...empresa, ...extras }, { requestId: ctx.requestId });
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
