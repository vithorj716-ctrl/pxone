// PX API — GET /api/public/v1/tabelas-frete
// Lista tabelas de frete cadastradas, opcionalmente filtradas por cliente.
//
// Query params: page, pageSize, cliente_id, ativo=true|false, search,
//   origem=<uf|cidade>, destino=<uf|cidade>
// Requer escopo: tabela-frete:read

import { createFileRoute } from "@tanstack/react-router";
import { withPxApi } from "@/px-api/middleware";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";
import { parsePagination, makeMeta } from "@/px-api/pagination";

export const Route = createFileRoute("/api/public/v1/tabelas-frete")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withPxApi(request, { scopes: ["tabela-frete:read"] }, async (ctx) => {
          const url = new URL(request.url);
          const { page, pageSize, from, to } = parsePagination(url, { defaultSize: 50, maxSize: 200 });
          const clienteId = url.searchParams.get("cliente_id")?.trim() || "";
          const ativoParam = url.searchParams.get("ativo");
          const origem = url.searchParams.get("origem")?.trim() || "";
          const destino = url.searchParams.get("destino")?.trim() || "";
          const search = url.searchParams.get("search")?.trim() || "";

          let q = (ctx.supabase as any)
            .from("tms_tabela_frete")
            .select("*", { count: "exact" })
            .order("nome", { ascending: true })
            .range(from, to);

          if (clienteId) q = q.eq("cliente_id", clienteId);
          if (ativoParam === "true") q = q.eq("ativo", true);
          if (ativoParam === "false") q = q.eq("ativo", false);
          if (origem) q = q.ilike("origem", `%${origem.replace(/[%_]/g, "")}%`);
          if (destino) q = q.ilike("destino", `%${destino.replace(/[%_]/g, "")}%`);
          if (search) {
            const s = search.replace(/[%_]/g, "");
            q = q.ilike("nome", `%${s}%`);
          }

          const { data, count, error } = await q;
          if (error) {
            return pxErr("INTERNAL", "Falha ao consultar tabelas de frete.", {
              requestId: ctx.requestId, details: error.message,
            });
          }

          // Regras comerciais estruturadas de cada tabela (compatível: campos legados seguem no item).
          const ids = (data ?? []).map((t: any) => t.id);
          let regrasPorTabela: Record<string, any[]> = {};
          if (ids.length) {
            const { data: regras } = await (ctx.supabase as any)
              .from("tms_tabela_regras")
              .select("*")
              .in("tabela_id", ids)
              .order("ordem", { ascending: true });
            regrasPorTabela = (regras ?? []).reduce((acc: Record<string, any[]>, r: any) => {
              (acc[r.tabela_id] ||= []).push(r);
              return acc;
            }, {});
          }

          return pxOk(
            {
              items: (data ?? []).map((t: any) => ({ ...t, regras: regrasPorTabela[t.id] ?? [] })),
              meta: makeMeta(page, pageSize, count ?? 0),
            },
            { requestId: ctx.requestId },
          );
        }),
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
