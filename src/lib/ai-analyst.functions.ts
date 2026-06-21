import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT =
  "Você é o CONSELHEIRO EXECUTIVO SÊNIOR do PXOne, o sistema corporativo do Grupo PX (PXLog — logística; PXMed — saúde; PXFarma — farmacêutico). " +
  "Atue como uma combinação de CFO, Controller, CEO Advisor, Estrategista de Negócios, especialista em Governança Corporativa, Valuation, Gestão de Riscos, Growth e Eficiência Operacional. " +
  "Você tem acesso COMPLETO E EM TEMPO REAL ao banco de dados operacional do grupo (empresas, custos, categorias, KPIs, snapshots históricos, valuations, riscos, decisões, projetos de payback, OKRs e key results, iniciativas de crescimento, updates a investidores, documentos, eventos da timeline, business plans). " +
  "REGRAS ABSOLUTAS: " +
  "1) Responda SEMPRE em português brasileiro, tom executivo, direto, com viés de ação. " +
  "2) Baseie cada afirmação EXCLUSIVAMENTE nos dados fornecidos no JSON de contexto. Se algo não existe nos dados, diga claramente 'não há dados suficientes cadastrados' e sugira o que deve ser registrado. NUNCA invente números. " +
  "3) Sempre que possível: cite números reais (R$, %, prazos), aponte tendências, riscos ocultos, oportunidades, gargalos e próximas ações concretas. " +
  "4) Estruture respostas com títulos curtos em **negrito** e bullets quando ajudar a leitura executiva. " +
  "5) Quando o usuário pedir 'conselho', 'sugestão', 'o que fazer', 'análise': entregue 3 a 5 recomendações priorizadas (Alto/Médio/Baixo impacto) com justificativa em uma linha cada. " +
  "6) Sempre pense como dono do negócio: caixa, margem, payback, risco, valuation, governança, escalabilidade.";

async function loadContext(supabase: any) {
  const [
    empresas, categorias, custos, kpis, kpiSnaps, valuations, riscos, decisoes,
    paybacks, okrs, krs, growth, investor, documents, timeline, bplans,
  ] = await Promise.all([
    supabase.from("empresas").select("*"),
    supabase.from("categorias_custo").select("*"),
    supabase.from("custos").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("kpis").select("*").limit(500),
    supabase.from("kpi_snapshots").select("*").order("data_referencia", { ascending: false }).limit(500),
    supabase.from("valuation_models").select("*").limit(300),
    supabase.from("risks").select("*").limit(300),
    supabase.from("decisions").select("*").order("data_decisao", { ascending: false }).limit(300),
    supabase.from("payback_projects").select("*").limit(300),
    supabase.from("okrs").select("*").limit(300),
    supabase.from("key_results").select("*").limit(500),
    supabase.from("growth_initiatives").select("*").limit(300),
    supabase.from("investor_updates").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("documents").select("id,titulo,tipo,empresa_id,created_at").limit(300),
    supabase.from("timeline_events").select("*").order("data_evento", { ascending: false }).limit(300),
    supabase.from("business_plans").select("*").limit(100),
  ]);
  return {
    empresas: empresas.data ?? [],
    categorias_custo: categorias.data ?? [],
    custos: custos.data ?? [],
    kpis: kpis.data ?? [],
    kpi_snapshots: kpiSnaps.data ?? [],
    valuations: valuations.data ?? [],
    riscos: riscos.data ?? [],
    decisoes: decisoes.data ?? [],
    paybacks: paybacks.data ?? [],
    okrs: okrs.data ?? [],
    key_results: krs.data ?? [],
    growth: growth.data ?? [],
    investor_updates: investor.data ?? [],
    documents: documents.data ?? [],
    timeline: timeline.data ?? [],
    business_plans: bplans.data ?? [],
  };
}

async function callGateway(messages: any[], model = "google/gemini-2.5-flash") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (resp.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace. Adicione créditos em Configurações → Planos & Créditos para reativar o conselheiro.");
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Falha na IA: ${resp.status} ${t.slice(0, 200)}`);
  }
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

export const askAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string; history?: { role: "user" | "assistant"; content: string }[] }) => {
    if (!input || typeof input.question !== "string" || input.question.length < 2 || input.question.length > 4000) {
      throw new Error("Pergunta inválida");
    }
    return {
      question: input.question,
      history: Array.isArray(input.history) ? input.history.slice(-10) : [],
    };
  })
  .handler(async ({ data, context }) => {
    const ctx = await loadContext(context.supabase);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content:
          `BANCO DE DADOS COMPLETO DO GRUPO PX (JSON, snapshot agora):\n${JSON.stringify(ctx).slice(0, 80000)}`,
      },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callGateway(messages);
    return { answer: answer || "Sem resposta." };
  });

export const getProactiveInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = await loadContext(context.supabase);
    const totalRegistros = Object.values(ctx).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    if (totalRegistros === 0) {
      return {
        insights: [
          {
            titulo: "Sistema vazio — comece pelo cadastro base",
            categoria: "Onboarding",
            prioridade: "Alta",
            mensagem: "Nenhum dado operacional foi cadastrado ainda. Comece cadastrando as empresas do grupo (PXLog, PXMed, PXFarma) em Empresas, depois as categorias de custo em Central de Custos.",
          },
        ],
      };
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content:
          `DADOS REAIS DO GRUPO PX (JSON):\n${JSON.stringify(ctx).slice(0, 60000)}\n\n` +
          "Gere de 3 a 5 INSIGHTS PROATIVOS para o executivo que acabou de abrir o painel do conselheiro. " +
          "Cada insight deve ser uma observação acionável baseada nos dados acima (gargalos, riscos, oportunidades, KPIs fora da meta, custos crescendo, decisões pendentes, OKRs atrasados, etc.). " +
          "Responda APENAS um JSON válido no formato: " +
          `{"insights":[{"titulo":"...","categoria":"Custos|Risco|KPI|Valuation|OKR|Decisão|Growth|Governança","prioridade":"Alta|Média|Baixa","mensagem":"frase executiva com número real quando possível"}]}. ` +
          "Sem markdown, sem texto fora do JSON.",
      },
    ];
    const raw = await callGateway(messages);
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed?.insights)) return { insights: parsed.insights.slice(0, 5) };
    } catch {}
    return {
      insights: [
        { titulo: "Análise gerada", categoria: "Geral", prioridade: "Média", mensagem: raw.slice(0, 400) },
      ],
    };
  });
