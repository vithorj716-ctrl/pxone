import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callPxAI } from "@/px-core/ai/core";

type Pergunta = { pergunta: string; empresaId?: string | null; empresaNome?: string | null };

export const askLastMileAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Pergunta) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: rotas }, { data: entregas }, { data: ocorrencias }, { data: motoristas }] = await Promise.all([
      supabase.from("tms_lm_rotas").select("id, numero, status, cidade, hora_saida, hora_prevista, hora_finalizada, valor_rota, motorista_id").limit(500),
      supabase.from("tms_lm_entregas").select("id, rota_id, status, cidade, prioridade, valor_mercadoria, concluida_em, janela_fim, cliente_id").limit(2000),
      supabase.from("tms_lm_ocorrencias").select("tipo, created_at, entrega_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("tms_lm_motoristas").select("id, nome").limit(200),
    ]);

    const motMap = new Map((motoristas ?? []).map((m: any) => [m.id, m.nome]));
    const rotasDto = (rotas ?? []).map((r: any) => ({ ...r, motorista: motMap.get(r.motorista_id) ?? null }));

    const total = (entregas ?? []).length;
    const entregues = (entregas ?? []).filter((e: any) => e.status === "entregue").length;
    const atrasadas = (entregas ?? []).filter((e: any) => e.janela_fim && new Date(e.janela_fim) < new Date() && e.status !== "entregue").length;

    const ctx = {
      total_rotas: rotasDto.length,
      por_status_rota: contar(rotasDto, "status"),
      total_entregas: total,
      entregues, atrasadas,
      otif_pct: total ? Math.round((entregues / total) * 100) : 0,
      por_status_entrega: contar(entregas ?? [], "status"),
      por_cidade: contar(entregas ?? [], "cidade"),
      por_prioridade: contar(entregas ?? [], "prioridade"),
      por_motorista_rotas: contar(rotasDto, "motorista"),
      ocorrencias_por_tipo: contar(ocorrencias ?? [], "tipo"),
      receita_prevista: rotasDto.reduce((a, b) => a + Number(b.valor_rota || 0), 0),
    };

    const sys = [
      "Você é o Analista Operacional do Last Mile (PXLog TMS).",
      "Especialista em última milha: roteirização, OTIF, produtividade de motoristas, ocorrências e risco de não conclusão.",
      "Responda direto, com números reais. Nunca invente dados. Use bullets curtos em rankings.",
      data.empresaNome ? `Empresa ativa: ${data.empresaNome}.` : "Modo Grupo.",
    ].join(" ");

    const res = await callPxAI({
      modulo: "tms-lm",
      modo: "analitico",
      empresa: data.empresaId ? { id: data.empresaId, nome: data.empresaNome ?? "" } : null,
      permitirComparativoEntreEmpresas: !data.empresaId,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Contexto JSON:\n${JSON.stringify(ctx).slice(0, 12000)}\n\nPergunta: ${data.pergunta}` },
      ],
    });
    return { resposta: res.content };
  });

function contar<T>(arr: T[], key: keyof T | ((x: T) => string)) {
  const m = new Map<string, number>();
  for (const it of arr) {
    const k = String(typeof key === "function" ? key(it) : it[key] ?? "—");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Object.fromEntries(m);
}
