import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Você é o ANALISTA EXECUTIVO do PXOne (Grupo PX). Produza análises curtas, diretas, com viés de ação, sempre em português brasileiro.
REGRAS:
- Use SOMENTE os números fornecidos no JSON. Nunca invente valores.
- Se faltar dado, diga "sem dados suficientes" para aquele ponto.
- Saída deve estar em JSON estrito com a forma: {"resumo":"...", "destaques":["..."], "alertas":["..."], "recomendacoes":["..."]}
- resumo: 2-3 frases executivas mencionando os números mais relevantes (R$, %, variações).
- destaques: 3-5 bullets com fatos concretos extraídos dos dados (sempre com número).
- alertas: 0-4 bullets de riscos, desvios, concentrações ou itens críticos detectados.
- recomendacoes: 3-5 ações priorizadas, cada uma começando com verbo no infinitivo.
- Não use emojis. Não use markdown. Não escreva nada fora do JSON.`;

export const generateExecutiveSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { moduleKey: string; moduleTitle: string; payload: any }) => {
    if (!input?.moduleKey || !input?.moduleTitle) throw new Error("Parâmetros inválidos");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const userMsg = `Módulo: ${data.moduleTitle} (${data.moduleKey})
Data de referência: ${new Date().toISOString().slice(0, 10)}
Dados agregados (JSON):
${JSON.stringify(data.payload).slice(0, 12000)}

Gere o relatório executivo conforme as REGRAS.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) throw new Error("Limite de IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações.");
    if (!resp.ok) throw new Error(`Falha na IA (${resp.status})`);

    const json: any = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      return {
        resumo: String(parsed.resumo ?? ""),
        destaques: Array.isArray(parsed.destaques) ? parsed.destaques.map(String) : [],
        alertas: Array.isArray(parsed.alertas) ? parsed.alertas.map(String) : [],
        recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes.map(String) : [],
      };
    } catch {
      return { resumo: raw.slice(0, 600), destaques: [], alertas: [], recomendacoes: [] };
    }
  });
