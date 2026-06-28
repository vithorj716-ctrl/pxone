import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callPxAI } from "@/px-core/ai/core";

type Pergunta = { pergunta: string; empresaId?: string | null; empresaNome?: string | null };

export const askTmsAnalyst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Pergunta) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Snapshot agregado (sem expor PII bruta)
    const [{ data: minutas }, { data: eventos }, { data: clientes }, { data: viagens }, { data: vEventos }, { data: cancel }] = await Promise.all([
      supabase.from("tms_minutas").select("numero, status, status_financeiro, origem, destino, qtd_volumes, peso_taxado, valor_frete, prazo_dias, cliente_id, cancelada_em, cancelamento_motivo, created_at").limit(500),
      supabase.from("tms_eventos").select("tipo, created_at, minuta_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("tms_clientes").select("id, nome").limit(200),
      supabase.from("tms_viagens").select("codigo, status, origem, destino, qtd_volumes_prev, qtd_volumes_emb, tempo_operacao_min, operador_id, iniciada_em").limit(200),
      supabase.from("tms_viagem_eventos").select("tipo, motivo, operador_id, viagem_id, created_at").limit(500),
      supabase.from("tms_cancelamentos").select("escopo, motivo, minuta_id, viagem_id, created_at").limit(300),
    ]);

    const clientesMap = new Map((clientes ?? []).map((c: any) => [c.id, c.nome]));
    const minutasDto = (minutas ?? []).map((m: any) => ({
      ...m,
      cliente: clientesMap.get(m.cliente_id) ?? null,
      cliente_id: undefined,
    }));

    const viagensDto = (viagens ?? []).map((v: any) => ({
      ...v,
      divergencia: Math.max(0, Number(v.qtd_volumes_prev || 0) - Number(v.qtd_volumes_emb || 0)),
      pct_conferencia: v.qtd_volumes_prev > 0 ? Math.round((v.qtd_volumes_emb / v.qtd_volumes_prev) * 100) : null,
    }));

    const ctx = {
      total_minutas: minutasDto.length,
      por_status: contar(minutasDto, "status"),
      por_status_financeiro: contar(minutasDto, "status_financeiro"),
      por_rota: contar(minutasDto, (m) => `${m.origem}→${m.destino}`),
      por_cliente: agregar(minutasDto, "cliente", (m) => Number(m.valor_frete || 0)),
      faturamento_total: minutasDto.reduce((a, b) => a + Number(b.valor_frete || 0), 0),
      eventos_recentes: (eventos ?? []).slice(0, 50).map((e: any) => ({ tipo: e.tipo, em: e.created_at })),
      // Operacional
      viagens: viagensDto,
      viagens_por_status: contar(viagensDto, "status"),
      viagens_incompletas: viagensDto.filter((v: any) => v.status === "finalizada" && v.divergencia > 0).length,
      top_divergencia: [...viagensDto].sort((a, b) => b.divergencia - a.divergencia).slice(0, 10).map((v: any) => ({ viagem: v.codigo, divergencia: v.divergencia })),
      pct_conferencia_medio: (() => {
        const arr = viagensDto.map((v: any) => v.pct_conferencia).filter((x: any) => x !== null);
        return arr.length ? Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length) : null;
      })(),
      erros_por_operador: contar((vEventos ?? []).filter((e: any) => e.tipo === "bip_erro"), "operador_id"),
      cancelamentos_por_motivo: contar(cancel ?? [], "motivo"),
      cancelamentos_por_cliente: (() => {
        const minutaCli = new Map(minutasDto.map((m: any) => [m.numero, m.cliente]));
        void minutaCli;
        const cliPorCancel: Record<string, number> = {};
        for (const c of cancel ?? []) {
          const m = (minutas ?? []).find((mm: any) => mm.id === (c as any).minuta_id) as any;
          const cli = m ? clientesMap.get(m.cliente_id) ?? "—" : "—";
          cliPorCancel[String(cli)] = (cliPorCancel[String(cli)] ?? 0) + 1;
        }
        return cliPorCancel;
      })(),
      volumes_esquecidos_no_hub: (vEventos ?? []).filter((e: any) => e.tipo === "volume_pendente").length,
    };

    const sys = [
      "Você é o Analista Operacional do TMS PXLog (Transfer Hub Goiânia↔Brasília).",
      "Responda de forma direta, com números reais do contexto. Nunca invente dados.",
      "Use bullets curtos quando listar rankings.",
      data.empresaNome ? `Empresa ativa: ${data.empresaNome}.` : "Modo Grupo: pode comparar empresas.",
    ].join(" ");

    const res = await callPxAI({
      modulo: "tms-pxlog",
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
function agregar<T>(arr: T[], key: keyof T, val: (x: T) => number) {
  const m = new Map<string, number>();
  for (const it of arr) {
    const k = String(it[key] ?? "—");
    m.set(k, (m.get(k) ?? 0) + val(it));
  }
  return Object.fromEntries(m);
}
