// PX API Layer — endpoint do Dashboard Global da plataforma.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [events, ai, custos, empresas, kpis, docs] = await Promise.all([
      sb.from("px_events").select("id, tipo, origem, created_at").order("created_at", { ascending: false }).limit(20),
      sb.from("px_ai_usage").select("id, modulo, modelo, tokens_in, tokens_out, created_at").order("created_at", { ascending: false }).limit(50),
      sb.from("custos").select("id", { count: "exact", head: true }),
      sb.from("empresas").select("id", { count: "exact", head: true }),
      sb.from("kpis").select("id", { count: "exact", head: true }),
      sb.from("documents").select("id", { count: "exact", head: true }),
    ]);

    const eventos = events.data ?? [];
    const usoIa = ai.data ?? [];
    const totalTokens = usoIa.reduce((a, r) => a + (r.tokens_in || 0) + (r.tokens_out || 0), 0);

    return {
      saude: "ok" as const,
      contadores: {
        custos: custos.count ?? 0,
        empresas: empresas.count ?? 0,
        kpis: kpis.count ?? 0,
        documentos: docs.count ?? 0,
      },
      eventos_recentes: eventos,
      eventos_total: eventos.length,
      ia: {
        chamadas_ultimas: usoIa.length,
        tokens_total: totalTokens,
        por_modulo: Object.entries(
          usoIa.reduce<Record<string, number>>((acc, r) => {
            acc[r.modulo] = (acc[r.modulo] || 0) + 1;
            return acc;
          }, {}),
        ).map(([modulo, chamadas]) => ({ modulo, chamadas })),
      },
    };
  });
