import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const loadFinancialData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [custosR, snapsR, mkR, empR, kpisR, bpR, catsR] = await Promise.all([
      supabase.from("custos").select("id,data,valor,nome,centro_custo,tipo_custo,status,empresa_id,categoria_id"),
      supabase.from("kpi_snapshots").select("*"),
      supabase.from("markup_calculations").select("preco_sugerido,resultados,margem_desejada,lucro_desejado"),
      supabase.from("empresas").select("id,nome,codigo"),
      supabase.from("kpis").select("nome,categoria,valor,meta,periodo"),
      supabase.from("business_plans").select("meta_receita,meta_ebitda,meta_valuation"),
      supabase.from("categorias_custo").select("id,nome"),
    ]);

    const catMap = new Map((catsR.data ?? []).map((c: any) => [c.id, c.nome]));
    const custos = (custosR.data ?? []).map((c: any) => ({
      id: c.id, data: c.data, valor: Number(c.valor || 0), nome: c.nome,
      categoria: catMap.get(c.categoria_id) ?? null,
      centro_custo: c.centro_custo, tipo_custo: c.tipo_custo,
      status: c.status, empresa_id: c.empresa_id,
    }));
    const snapshots = (snapsR.data ?? []).map((s: any) => ({
      empresa_id: s.empresa_id, periodo: s.periodo,
      receita: Number(s.receita || 0), ebitda: Number(s.ebitda || 0),
      lucro_liquido: Number(s.lucro_liquido || 0), caixa: Number(s.caixa || 0),
      capital_giro: Number(s.capital_giro || 0),
      contas_pagar: Number(s.contas_pagar || 0), contas_receber: Number(s.contas_receber || 0),
      endividamento: Number(s.endividamento || 0), valuation: Number(s.valuation || 0),
    }));
    const markups = (mkR.data ?? []).map((m: any) => Number(m?.resultados?.markupPct ?? 0)).filter((n: number) => n > 0);
    const markupMedio = markups.length > 0 ? markups.reduce((a: number, b: number) => a + b, 0) / markups.length : 0;
    const metaReceita = (bpR.data ?? []).reduce((a: number, b: any) => a + Number(b.meta_receita || 0), 0);
    const metaEbitda = (bpR.data ?? []).reduce((a: number, b: any) => a + Number(b.meta_ebitda || 0), 0);

    return {
      custos,
      snapshots,
      markupMedio,
      empresas: empR.data ?? [],
      kpis: kpisR.data ?? [],
      metaReceita: metaReceita || null,
      metaEbitda: metaEbitda || null,
    };
  });

export const saveScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { nome: string; descricao?: string; empresa_id?: string | null; payload: any }) => i)
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("financial_scenarios")
      .insert({
        user_id: context.userId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        empresa_id: data.empresa_id ?? null,
        payload: data.payload,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("financial_scenarios").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
