import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onlyDigits } from "./cnpj";

// PXSales — Etapa 3: leads, oportunidades, funil e atividades (follow-ups).
// Toda a validação de acesso acontece no servidor (requireSupabaseAuth + RLS por sistema).

export type PipelineEtapaRow = {
  id: string;
  chave: string;
  label: string;
  cor: string;
  ordem: number;
  tipo: string;
  ativo: boolean;
};

export type LeadRow = {
  id: string;
  cnpj: string | null;
  empresa: string;
  nome_fantasia: string | null;
  cidade: string | null;
  uf: string | null;
  segmento: string | null;
  origem: string;
  contato_nome: string | null;
  contato_cargo: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  potencial_mensal: number | null;
  tipo_carga: string | null;
  temperatura: string;
  etapa: string;
  status: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  proxima_acao: string | null;
  proxima_acao_em: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
  cliente_id: string | null;
  convertido_em: string | null;
  created_at: string;
};

export type OportunidadeRow = {
  id: string;
  titulo: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  lead_id: string | null;
  empresa_nome: string | null;
  etapa: string;
  status: string;
  valor_estimado: number;
  frequencia_mensal: number | null;
  margem_percentual: number | null;
  probabilidade: number;
  previsao_fechamento: string | null;
  tipo_operacao: string | null;
  origem: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
  created_at: string;
};

export type AtividadeRow = {
  id: string;
  tipo: string;
  assunto: string;
  descricao: string | null;
  lead_id: string | null;
  oportunidade_id: string | null;
  cliente_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  prevista_para: string | null;
  concluida: boolean;
  concluida_em: string | null;
  resultado: string | null;
  referencia: string | null;
  created_at: string;
};

export const ORIGENS_LEAD = [
  "prospeccao",
  "indicacao",
  "site",
  "whatsapp",
  "telefone",
  "evento",
  "parceiro",
  "outro",
] as const;

export const TIPOS_ATIVIDADE = [
  "ligacao",
  "email",
  "whatsapp",
  "visita",
  "reuniao",
  "tarefa",
] as const;

async function nomesUsuarios(sb: any, ids: (string | null)[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniq.length) return new Map<string, string>();
  const { data } = await sb.from("px_usuarios_meta").select("user_id,nome,login").in("user_id", uniq);
  return new Map<string, string>((data ?? []).map((u: any) => [u.user_id, u.nome || u.login]));
}

/** Etapas configuráveis do funil. */
export const listPipelineEtapas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PipelineEtapaRow[]> => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("pxsales_pipeline_etapas")
      .select("id,chave,label,cor,ordem,tipo,ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PipelineEtapaRow[];
  });

/** Usuários disponíveis como responsáveis comerciais. */
export const listResponsaveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data } = await sb
      .from("px_usuarios_meta")
      .select("user_id,nome,login")
      .order("nome", { ascending: true });
    return ((data ?? []) as any[]).map((u) => ({
      id: u.user_id as string,
      nome: (u.nome || u.login) as string,
    }));
  });

/* ---------------------------------- LEADS --------------------------------- */

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { search?: string; etapa?: string; status?: string; responsavel_id?: string; meus?: boolean } | undefined) =>
      d ?? {},
  )
  .handler(async ({ data, context }): Promise<LeadRow[]> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    let q = sb.from("pxsales_leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.etapa) q = q.eq("etapa", data.etapa);
    if (data.status) q = q.eq("status", data.status);
    if (data.responsavel_id) q = q.eq("responsavel_id", data.responsavel_id);
    if (data.meus) q = q.eq("responsavel_id", userId);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(
        `empresa.ilike.%${s}%,nome_fantasia.ilike.%${s}%,contato_nome.ilike.%${s}%,cidade.ilike.%${s}%,cnpj.ilike.%${onlyDigits(s) || s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const nomes = await nomesUsuarios(sb, (rows ?? []).map((r: any) => r.responsavel_id));
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      responsavel_nome: r.responsavel_id ? nomes.get(r.responsavel_id) ?? null : null,
    })) as LeadRow[];
  });

export const saveLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.empresa || !String(d.empresa).trim()) throw new Error("Informe a empresa do lead.");
    return d as Record<string, any>;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    const { id, ...rest } = data;
    const payload: Record<string, any> = {
      ...rest,
      cnpj: rest.cnpj ? onlyDigits(String(rest.cnpj)) : null,
      potencial_mensal: rest.potencial_mensal === "" || rest.potencial_mensal == null ? null : Number(rest.potencial_mensal),
      proxima_acao_em: rest.proxima_acao_em || null,
      responsavel_id: rest.responsavel_id || null,
      updated_by: userId,
    };
    if (id) {
      const { error } = await sb.from("pxsales_leads").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await sb
      .from("pxsales_leads")
      .insert({ ...payload, created_by: userId, responsavel_id: payload.responsavel_id ?? userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const moverLeadEtapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; etapa: string; motivo_perda?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    const status = data.etapa === "perdido" ? "perdido" : data.etapa === "ganho" ? "ganho" : "aberto";
    const { error } = await sb
      .from("pxsales_leads")
      .update({ etapa: data.etapa, status, motivo_perda: data.motivo_perda ?? null, updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("pxsales_leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Converte o lead em oportunidade. Se houver CNPJ já cadastrado no PX Registry,
 * a oportunidade nasce ligada ao cliente único — nunca duplicamos cadastro.
 */
export const converterLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; valor_estimado?: number; previsao_fechamento?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    const { data: lead, error: e1 } = await sb.from("pxsales_leads").select("*").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);

    let clienteId: string | null = lead.cliente_id ?? null;
    if (!clienteId && lead.cnpj) {
      const { data: cli } = await sb
        .from("px_registry_clientes")
        .select("id")
        .eq("cnpj", onlyDigits(String(lead.cnpj)))
        .maybeSingle();
      clienteId = cli?.id ?? null;
    }

    const { data: op, error: e2 } = await sb
      .from("pxsales_oportunidades")
      .insert({
        titulo: `Oportunidade — ${lead.empresa}`,
        cliente_id: clienteId,
        lead_id: lead.id,
        empresa_nome: lead.empresa,
        etapa: "qualificacao",
        valor_estimado: data.valor_estimado ?? lead.potencial_mensal ?? 0,
        previsao_fechamento: data.previsao_fechamento || null,
        origem: lead.origem,
        responsavel_id: lead.responsavel_id ?? userId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    await sb
      .from("pxsales_leads")
      .update({ status: "convertido", etapa: "cotacao", cliente_id: clienteId, convertido_em: new Date().toISOString(), updated_by: userId })
      .eq("id", lead.id);

    await sb.from("pxsales_oportunidade_historico").insert({
      oportunidade_id: op.id,
      etapa_anterior: null,
      etapa_nova: "qualificacao",
      observacao: "Criada a partir do lead",
      created_by: userId,
    });

    return { oportunidade_id: op.id as string, cliente_id: clienteId };
  });

/* ------------------------------ OPORTUNIDADES ----------------------------- */

export const listOportunidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { search?: string; responsavel_id?: string; meus?: boolean; incluirFechadas?: boolean } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }): Promise<OportunidadeRow[]> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    let q = sb.from("pxsales_oportunidades").select("*").order("updated_at", { ascending: false }).limit(500);
    if (data.responsavel_id) q = q.eq("responsavel_id", data.responsavel_id);
    if (data.meus) q = q.eq("responsavel_id", userId);
    if (!data.incluirFechadas) q = q.eq("status", "aberta");
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`titulo.ilike.%${s}%,empresa_nome.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const nomes = await nomesUsuarios(sb, list.map((r) => r.responsavel_id));
    const clienteIds = Array.from(new Set(list.map((r) => r.cliente_id).filter(Boolean)));
    let clientes = new Map<string, string>();
    if (clienteIds.length) {
      const { data: cli } = await sb
        .from("px_registry_clientes")
        .select("id,razao_social,nome_fantasia")
        .in("id", clienteIds);
      clientes = new Map((cli ?? []).map((c: any) => [c.id, c.nome_fantasia || c.razao_social]));
    }

    return list.map((r) => ({
      ...r,
      valor_estimado: Number(r.valor_estimado ?? 0),
      cliente_nome: r.cliente_id ? clientes.get(r.cliente_id) ?? null : null,
      responsavel_nome: r.responsavel_id ? nomes.get(r.responsavel_id) ?? null : null,
    })) as OportunidadeRow[];
  });

export const saveOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.titulo || !String(d.titulo).trim()) throw new Error("Informe o título da oportunidade.");
    return d as Record<string, any>;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    const { id, ...rest } = data;
    const num = (v: any) => (v === "" || v == null ? null : Number(v));
    const payload: Record<string, any> = {
      ...rest,
      cliente_id: rest.cliente_id || null,
      valor_estimado: num(rest.valor_estimado) ?? 0,
      frequencia_mensal: num(rest.frequencia_mensal),
      margem_percentual: num(rest.margem_percentual),
      probabilidade: num(rest.probabilidade) ?? 50,
      previsao_fechamento: rest.previsao_fechamento || null,
      responsavel_id: rest.responsavel_id || null,
      updated_by: userId,
    };
    if (id) {
      const { error } = await sb.from("pxsales_oportunidades").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await sb
      .from("pxsales_oportunidades")
      .insert({ ...payload, created_by: userId, responsavel_id: payload.responsavel_id ?? userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("pxsales_oportunidade_historico").insert({
      oportunidade_id: ins.id,
      etapa_nova: payload.etapa ?? "qualificacao",
      observacao: "Oportunidade criada",
      created_by: userId,
    });
    return { id: ins.id as string };
  });

export const moverOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; etapa: string; motivo_perda?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    const { data: atual, error: e1 } = await sb
      .from("pxsales_oportunidades")
      .select("etapa")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    if (atual.etapa === data.etapa) return { ok: true };

    const status = data.etapa === "ganho" ? "ganha" : data.etapa === "perdido" ? "perdida" : "aberta";
    const { error } = await sb
      .from("pxsales_oportunidades")
      .update({
        etapa: data.etapa,
        status,
        motivo_perda: data.etapa === "perdido" ? data.motivo_perda ?? null : null,
        fechada_em: status === "aberta" ? null : new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await sb.from("pxsales_oportunidade_historico").insert({
      oportunidade_id: data.id,
      etapa_anterior: atual.etapa,
      etapa_nova: data.etapa,
      observacao: data.motivo_perda ?? null,
      created_by: userId,
    });
    return { ok: true };
  });

export const excluirOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("pxsales_oportunidades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOportunidadeHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows } = await sb
      .from("pxsales_oportunidade_historico")
      .select("*")
      .eq("oportunidade_id", data.id)
      .order("created_at", { ascending: false });
    const nomes = await nomesUsuarios(sb, (rows ?? []).map((r: any) => r.created_by));
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      autor: r.created_by ? nomes.get(r.created_by) ?? null : null,
    }));
  });

/* -------------------------- ATIVIDADES / FOLLOW-UP ------------------------- */

export const listAtividades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { filtro?: "hoje" | "atrasados" | "programados" | "concluidos" | "todos"; meus?: boolean; lead_id?: string; oportunidade_id?: string } | undefined) =>
      d ?? {},
  )
  .handler(async ({ data, context }): Promise<AtividadeRow[]> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    let q = sb.from("pxsales_atividades").select("*").order("prevista_para", { ascending: true }).limit(500);
    if (data.lead_id) q = q.eq("lead_id", data.lead_id);
    if (data.oportunidade_id) q = q.eq("oportunidade_id", data.oportunidade_id);
    if (data.meus) q = q.eq("responsavel_id", userId);

    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1).toISOString();

    if (data.filtro === "hoje") q = q.eq("concluida", false).gte("prevista_para", inicioDia).lt("prevista_para", fimDia);
    else if (data.filtro === "atrasados") q = q.eq("concluida", false).lt("prevista_para", inicioDia);
    else if (data.filtro === "programados") q = q.eq("concluida", false).gte("prevista_para", fimDia);
    else if (data.filtro === "concluidos") q = q.eq("concluida", true);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const nomes = await nomesUsuarios(sb, list.map((r) => r.responsavel_id));

    const leadIds = Array.from(new Set(list.map((r) => r.lead_id).filter(Boolean)));
    const opIds = Array.from(new Set(list.map((r) => r.oportunidade_id).filter(Boolean)));
    const [leads, ops] = await Promise.all([
      leadIds.length ? sb.from("pxsales_leads").select("id,empresa").in("id", leadIds) : Promise.resolve({ data: [] }),
      opIds.length ? sb.from("pxsales_oportunidades").select("id,titulo").in("id", opIds) : Promise.resolve({ data: [] }),
    ]);
    const leadMap = new Map((leads.data ?? []).map((l: any) => [l.id, l.empresa]));
    const opMap = new Map((ops.data ?? []).map((o: any) => [o.id, o.titulo]));

    return list.map((r) => ({
      ...r,
      responsavel_nome: r.responsavel_id ? nomes.get(r.responsavel_id) ?? null : null,
      referencia: r.lead_id ? leadMap.get(r.lead_id) ?? null : r.oportunidade_id ? opMap.get(r.oportunidade_id) ?? null : null,
    })) as AtividadeRow[];
  });

export const saveAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.assunto || !String(d.assunto).trim()) throw new Error("Informe o assunto da atividade.");
    return d as Record<string, any>;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    const { id, ...rest } = data;
    const payload: Record<string, any> = {
      ...rest,
      lead_id: rest.lead_id || null,
      oportunidade_id: rest.oportunidade_id || null,
      cliente_id: rest.cliente_id || null,
      prevista_para: rest.prevista_para || null,
      responsavel_id: rest.responsavel_id || null,
      updated_by: userId,
    };
    if (id) {
      const { error } = await sb.from("pxsales_atividades").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await sb
      .from("pxsales_atividades")
      .insert({ ...payload, created_by: userId, responsavel_id: payload.responsavel_id ?? userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const concluirAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; concluida: boolean; resultado?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    const { error } = await sb
      .from("pxsales_atividades")
      .update({
        concluida: data.concluida,
        concluida_em: data.concluida ? new Date().toISOString() : null,
        resultado: data.resultado ?? null,
        updated_by: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("pxsales_atividades").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
