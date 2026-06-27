import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callGateway(messages: any[], model = "google/gemini-2.5-flash-lite") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (resp.status === 429) throw new Error("Limite de requisições da IA atingido.");
  if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
  if (!resp.ok) throw new Error(`Falha na IA: ${resp.status}`);
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

export const analisarCustos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { resumo: any }) => i)
  .handler(async ({ data }) => {
    const messages = [
      {
        role: "system",
        content:
          "Você é o CFO virtual do Grupo PX. Analise o resumo financeiro abaixo e gere insights executivos curtos, acionáveis e baseados em números reais. Responda APENAS JSON válido: " +
          `{"resumo":"1 parágrafo executivo","alertas":[{"titulo":"","mensagem":"","prioridade":"Alta|Média|Baixa"}],"oportunidades":[{"titulo":"","mensagem":""}],"acoes":["ação 1","ação 2","ação 3"]}`,
      },
      { role: "user", content: JSON.stringify(data.resumo).slice(0, 30000) },
    ];
    const raw = await callGateway(messages);
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { resumo: raw.slice(0, 600), alertas: [], oportunidades: [], acoes: [] };
    }
  });
