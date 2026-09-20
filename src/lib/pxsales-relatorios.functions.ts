import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// PXSales — Etapas 8/9: indicadores do dashboard e relatórios comerciais.

export type DashboardPxSales = {
  pipeline: { etapa: string; qtd: number; valor: number }[];
  kpis: {
    leads_novos: number;
    leads_negociacao: number;
    cotacoes_abertas: number;
    cotacoes_aguardando: number;
    propostas_aceitas: number;
    propostas_recusadas: number;
    valor_pipeline: number;
    taxa_conversao: number;
    ticket_medio: number;
    clientes_ativos: number;
    followups_atrasados: number;
    comissoes_previstas: number;
  };
  agenda: {
    id: string;
    titulo: string;
    tipo: string;
    data_prevista: string | null;
    empresa_nome: string | null;
    concluida: boolean;
    atrasada: boolean;
  }[];
  ultimas_propostas: { id: string; numero: number; empresa_nome: string; valor_total: number; status: string; created_at: string }[];
};

const num = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

export const getDashboardPxSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardPxSales> => {
    const sb = (context as any).supabase as any;
    const hoje = new Date().toISOString();

    const [leads, oportunidades, cotacoes, propostas, atividades, comissoes, clientes] = await Promise.all([
      sb.from("pxsales_leads").select("id,etapa,potencial_mensal,created_at").limit(2000),
      sb.from("pxsales_oportunidades").select("id,etapa,valor_estimado").limit(2000),
      sb.from("pxsales_cotacoes").select("id,status,valor_total").limit(2000),
      sb.from("pxsales_propostas").select("id,numero,empresa_nome,valor_total,status,created_at").order("created_at", { ascending: false }).limit(500),
      sb.from("pxsales_atividades").select("id,assunto,tipo,prevista_para,concluida,cliente_id").order("prevista_para", { ascending: true }).limit(200),
      sb.from("pxsales_comissoes").select("valor,status").limit(2000),
      sb.from("px_registry_clientes").select("id,ativo").limit(5000),
    ]);

    const ops = (oportunidades.data ?? []) as any[];
    const lds = (leads.data ?? []) as any[];
    const cots = (cotacoes.data ?? []) as any[];
    const props = (propostas.data ?? []) as any[];
    const atvs = (atividades.data ?? []) as any[];
    const coms = (comissoes.data ?? []) as any[];
    const clis = (clientes.data ?? []) as any[];

    const porEtapa = new Map<string, { qtd: number; valor: number }>();
    for (const o of ops) {
      const k = o.etapa ?? "novo_lead";
      const cur = porEtapa.get(k) ?? { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += num(o.valor_estimado);
      porEtapa.set(k, cur);
    }

    const aceitas = props.filter((p) => p.status === "aceita");
    const recusadas = props.filter((p) => p.status === "recusada");
    const valorAceitas = aceitas.reduce((s, p) => s + num(p.valor_total), 0);
    const respondidas = aceitas.length + recusadas.length;

    return {
      pipeline: Array.from(porEtapa.entries()).map(([etapa, v]) => ({ etapa, ...v })),
      kpis: {
        leads_novos: lds.filter((l) => l.etapa === "novo_lead").length,
        leads_negociacao: lds.filter((l) => ["qualificacao", "contato", "negociacao"].includes(l.etapa)).length,
        cotacoes_abertas: cots.filter((c) => ["rascunho", "enviada"].includes(c.status)).length,
        cotacoes_aguardando: cots.filter((c) => c.status === "enviada").length,
        propostas_aceitas: aceitas.length,
        propostas_recusadas: recusadas.length,
        valor_pipeline: ops.reduce((s, o) => s + num(o.valor_estimado), 0),
        taxa_conversao: respondidas ? Math.round((aceitas.length / respondidas) * 100) : 0,
        ticket_medio: aceitas.length ? valorAceitas / aceitas.length : 0,
        clientes_ativos: clis.filter((c) => c.ativo !== false).length,
        followups_atrasados: atvs.filter((a) => !a.concluida && a.prevista_para && a.prevista_para < hoje).length,
        comissoes_previstas: coms.filter((c) => c.status === "prevista").reduce((s, c) => s + num(c.valor), 0),
      },
      agenda: atvs
        .filter((a) => !a.concluida)
        .slice(0, 40)
        .map((a) => ({
          id: a.id,
          titulo: a.assunto,
          tipo: a.tipo,
          data_prevista: a.prevista_para ?? null,
          empresa_nome: null,
          concluida: !!a.concluida,
          atrasada: !!a.prevista_para && a.prevista_para < hoje,
        })),
      ultimas_propostas: props.slice(0, 8).map((p) => ({
        id: p.id,
        numero: Number(p.numero),
        empresa_nome: p.empresa_nome,
        valor_total: num(p.valor_total),
        status: p.status,
        created_at: p.created_at,
      })),
    };
  });

export type RelatorioComercial = {
  por_responsavel: { responsavel_id: string | null; nome: string; propostas: number; aceitas: number; valor: number; comissao: number }[];
  por_cliente: { empresa_nome: string; propostas: number; valor: number }[];
  por_mes: { mes: string; propostas: number; aceitas: number; valor: number }[];
  motivos_perda: { motivo: string; qtd: number }[];
};

export const getRelatorioComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { de?: string; ate?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<RelatorioComercial> => {
    const sb = (context as any).supabase as any;

    let q = sb
      .from("pxsales_propostas")
      .select("id,empresa_nome,valor_total,status,responsavel_id,created_at,motivo")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.de) q = q.gte("created_at", data.de);
    if (data.ate) q = q.lte("created_at", `${data.ate}T23:59:59`);

    const [{ data: props }, { data: coms }, { data: perfis }] = await Promise.all([
      q,
      sb.from("pxsales_comissoes").select("responsavel_id,valor,status").limit(2000),
      sb.from("profiles").select("id,display_name").limit(500),
    ]);

    const nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.display_name as string]));
    const P = (props ?? []) as any[];

    const resp = new Map<string, { propostas: number; aceitas: number; valor: number; comissao: number }>();
    for (const p of P) {
      const k = p.responsavel_id ?? "—";
      const cur = resp.get(k) ?? { propostas: 0, aceitas: 0, valor: 0, comissao: 0 };
      cur.propostas += 1;
      if (p.status === "aceita") {
        cur.aceitas += 1;
        cur.valor += num(p.valor_total);
      }
      resp.set(k, cur);
    }
    for (const c of (coms ?? []) as any[]) {
      if (c.status === "cancelada") continue;
      const k = c.responsavel_id ?? "—";
      const cur = resp.get(k) ?? { propostas: 0, aceitas: 0, valor: 0, comissao: 0 };
      cur.comissao += num(c.valor);
      resp.set(k, cur);
    }

    const cli = new Map<string, { propostas: number; valor: number }>();
    for (const p of P) {
      const cur = cli.get(p.empresa_nome) ?? { propostas: 0, valor: 0 };
      cur.propostas += 1;
      cur.valor += num(p.valor_total);
      cli.set(p.empresa_nome, cur);
    }

    const mes = new Map<string, { propostas: number; aceitas: number; valor: number }>();
    for (const p of P) {
      const k = String(p.created_at).slice(0, 7);
      const cur = mes.get(k) ?? { propostas: 0, aceitas: 0, valor: 0 };
      cur.propostas += 1;
      if (p.status === "aceita") {
        cur.aceitas += 1;
        cur.valor += num(p.valor_total);
      }
      mes.set(k, cur);
    }

    const motivos = new Map<string, number>();
    for (const p of P.filter((x) => x.status === "recusada")) {
      const k = (p.motivo ?? "Não informado").slice(0, 80);
      motivos.set(k, (motivos.get(k) ?? 0) + 1);
    }

    return {
      por_responsavel: Array.from(resp.entries())
        .map(([id, v]) => ({
          responsavel_id: id === "—" ? null : id,
          nome: (nomes.get(id) as string) ?? "Sem responsável",
          ...v,
        }))
        .sort((a, b) => b.valor - a.valor),
      por_cliente: Array.from(cli.entries())
        .map(([empresa_nome, v]) => ({ empresa_nome, ...v }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 20),
      por_mes: Array.from(mes.entries())
        .map(([m, v]) => ({ mes: m, ...v }))
        .sort((a, b) => (a.mes < b.mes ? 1 : -1))
        .slice(0, 12),
      motivos_perda: Array.from(motivos.entries())
        .map(([motivo, qtd]) => ({ motivo, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 10),
    };
  });
