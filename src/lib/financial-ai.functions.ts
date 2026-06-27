import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Mode = "dre" | "dfc" | "break-even" | "cockpit" | "radar";

async function callGateway(messages: any[], model = "google/gemini-2.5-flash") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (r.status === 429) throw new Error("Limite de IA atingido");
  if (r.status === 402) throw new Error("Créditos de IA esgotados");
  if (!r.ok) throw new Error(`Falha IA ${r.status}`);
  const j: any = await r.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

const SYSTEMS: Record<Mode, string> = {
  dre: "Você é o CFO virtual. Analise APENAS os agregados do DRE enviados. Nunca invente números — use os dados recebidos. Responda JSON estrito: {\"diagnostico\":\"\",\"evidencias\":[\"\"],\"impactoFinanceiroEstimado\":\"R$ ...\",\"recomendacoes\":[\"\"]}",
  dfc: "Você é o CFO virtual. Analise o Fluxo de Caixa agregado. Aponte mês com risco, saldo projetado, capacidade de investimento e distribuição. JSON: {\"diagnostico\":\"\",\"evidencias\":[\"\"],\"impactoFinanceiroEstimado\":\"R$ ...\",\"recomendacoes\":[\"\"]}",
  "break-even": "Você é o CFO virtual. Avalie o ponto de equilíbrio e cenários. Indique qual variável gera maior impacto. JSON: {\"diagnostico\":\"\",\"evidencias\":[\"\"],\"impactoFinanceiroEstimado\":\"R$ ...\",\"recomendacoes\":[\"\"]}",
  cockpit: "Você é o conselheiro financeiro do CEO. Avalie a saúde geral do negócio a partir dos indicadores. JSON: {\"diagnostico\":\"\",\"evidencias\":[\"\"],\"impactoFinanceiroEstimado\":\"R$ ...\",\"recomendacoes\":[\"\"]}",
  radar: "Você é um analista de riscos financeiros. Detecte alertas no resumo executivo. Responda JSON: {\"alertas\":[{\"titulo\":\"\",\"motivo\":\"\",\"impacto\":\"R$ ...\",\"prioridade\":\"alta|media|baixa\",\"semaforo\":\"verde|amarelo|vermelho\",\"recomendacao\":\"\",\"link\":\"\"}]}",
};

export const askFinancialAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { mode: Mode; summary: any; pergunta?: string }) => i)
  .handler(async ({ data }) => {
    const userMsg = data.pergunta
      ? `Pergunta do CEO: ${data.pergunta}\n\nResumo executivo (use APENAS estes números):\n${JSON.stringify(data.summary)}`
      : `Resumo executivo (use APENAS estes números):\n${JSON.stringify(data.summary)}`;
    const messages = [
      { role: "system", content: SYSTEMS[data.mode] },
      { role: "user", content: userMsg.slice(0, 28000) },
    ];
    const raw = await callGateway(messages);
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { diagnostico: raw.slice(0, 600), evidencias: [], impactoFinanceiroEstimado: "—", recomendacoes: [] };
    }
  });
