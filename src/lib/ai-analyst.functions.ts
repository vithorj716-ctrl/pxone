import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string }) => {
    if (!input || typeof input.question !== "string" || input.question.length < 2 || input.question.length > 2000) {
      throw new Error("Pergunta inválida");
    }
    return { question: input.question };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [empresas, custos, kpis, valuations, riscos, decisoes, paybacks, okrs] = await Promise.all([
      supabase.from("empresas").select("codigo,nome,ativo"),
      supabase.from("custos").select("nome,valor,status,empresa_id,tipo,categoria_id").limit(500),
      supabase.from("kpis").select("nome,categoria,valor,meta,unidade,periodo,empresa_id").limit(300),
      supabase.from("valuation_models").select("metodologia,ebitda,multiplo,valor_calculado,empresa_id,ano_base").limit(200),
      supabase.from("risks").select("titulo,categoria,probabilidade,impacto,status").limit(200),
      supabase.from("decisions").select("titulo,status,impacto_financeiro,data_decisao").limit(200),
      supabase.from("payback_projects").select("nome,investimento_inicial,retorno_mensal,prazo_meses,status").limit(200),
      supabase.from("okrs").select("objetivo,trimestre,progresso").limit(200),
    ]);

    const contextoDados = {
      empresas: empresas.data ?? [],
      custos: custos.data ?? [],
      kpis: kpis.data ?? [],
      valuations: valuations.data ?? [],
      riscos: riscos.data ?? [],
      decisoes: decisoes.data ?? [],
      paybacks: paybacks.data ?? [],
      okrs: okrs.data ?? [],
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é o AI Business Analyst do PXOne, o sistema corporativo do Grupo PX (PXLog, PXMed, PXFarma). " +
              "Responda SEMPRE em português, de forma direta, executiva e baseada APENAS nos dados fornecidos no contexto. " +
              "Se um dado não existir no contexto, diga 'não há dados suficientes no sistema'. Nunca invente números. " +
              "Quando útil, sugira ações concretas (ex: cadastrar mais KPIs, revisar premissas de valuation).",
          },
          {
            role: "user",
            content:
              `Dados atuais do sistema (JSON):\n${JSON.stringify(contextoDados).slice(0, 30000)}\n\nPergunta: ${data.question}`,
          },
        ],
      }),
    });

    if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Contate o administrador.");
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Falha na IA: ${resp.status} ${t.slice(0, 200)}`);
    }

    const json: any = await resp.json();
    const answer = json?.choices?.[0]?.message?.content ?? "Sem resposta.";
    return { answer };
  });
