import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Você é um especialista sênior em PRECIFICAÇÃO, MARKUP, MARGEM e ESTRATÉGIA DE PREÇOS do PXOne.
Responde sempre em português, executivo, direto, baseado APENAS nos indicadores resumidos fornecidos.
Nunca invente números. Se faltar dado, diga o que precisa ser cadastrado.
Sempre que possível: cite valores reais (R$, %), aponte risco, oportunidade e ação concreta em 1 linha.`;

async function loadResumo(supabase: any) {
  const [custos, empresas, calcs] = await Promise.all([
    supabase.from("custos").select("valor,tipo_custo,centro_custo,empresa_id").limit(2000),
    supabase.from("empresas").select("id,codigo,nome"),
    supabase.from("markup_calculations").select("produto,empresa_id,resultados,preco_sugerido,margem_desejada,lucro_desejado,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const cs: any[] = custos.data ?? [];
  const total = cs.reduce((a, c) => a + Number(c.valor || 0), 0);
  const fixos = cs.filter(c => c.tipo_custo === "fixo").reduce((a, c) => a + Number(c.valor || 0), 0);
  const variaveis = cs.filter(c => c.tipo_custo === "variavel").reduce((a, c) => a + Number(c.valor || 0), 0);
  const porCentro: Record<string, number> = {};
  for (const c of cs) {
    const k = c.centro_custo || "Sem centro";
    porCentro[k] = (porCentro[k] || 0) + Number(c.valor || 0);
  }
  const topCentros = Object.entries(porCentro).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const calcsArr: any[] = calcs.data ?? [];
  const margens = calcsArr.map(c => Number(c.resultados?.margemPct || 0)).filter(n => !isNaN(n));
  const markups = calcsArr.map(c => Number(c.resultados?.markupPct || 0)).filter(n => !isNaN(n));
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const topLucro = calcsArr
    .map(c => ({ produto: c.produto, lucro: Number(c.resultados?.lucroLiquido || 0), margem: Number(c.resultados?.margemPct || 0) }))
    .sort((a, b) => b.lucro - a.lucro).slice(0, 5);
  const prejuizo = calcsArr.filter(c => Number(c.resultados?.lucroLiquido || 0) < 0)
    .map(c => ({ produto: c.produto, lucro: Number(c.resultados?.lucroLiquido || 0) })).slice(0, 5);

  return {
    empresas: (empresas.data ?? []).map((e: any) => ({ codigo: e.codigo, nome: e.nome })),
    custos: { total, fixos, variaveis, topCentros },
    precificacao: {
      total_calculos: calcsArr.length,
      markup_medio_pct: Number(avg(markups).toFixed(2)),
      margem_media_pct: Number(avg(margens).toFixed(2)),
      top_lucro: topLucro,
      em_prejuizo: prejuizo,
    },
  };
}

async function callGateway(messages: any[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para reativar o conselheiro de preços.");
  if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
  if (!resp.ok) throw new Error(`Falha na IA: ${resp.status}`);
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

export const askPricingAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string; history?: { role: "user" | "assistant"; content: string }[] }) => {
    if (!input?.question || input.question.length < 2 || input.question.length > 4000) throw new Error("Pergunta inválida");
    return { question: input.question, history: Array.isArray(input.history) ? input.history.slice(-8) : [] };
  })
  .handler(async ({ data, context }) => {
    const resumo = await loadResumo(context.supabase);
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: `RESUMO AGREGADO (sem listas brutas):\n${JSON.stringify(resumo)}` },
      ...data.history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callGateway(messages);
    return { answer: answer || "Sem resposta." };
  });
