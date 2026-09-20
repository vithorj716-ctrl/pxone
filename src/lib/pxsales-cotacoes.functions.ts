import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularFrete, type TabelaFrete } from "@/pxsales/frete-calc";

// PXSales — Etapa 4: cotações (com tabela de frete do PXLog), propostas e envio para a operação.

export type TabelaFreteRow = TabelaFrete & {
  cliente_id: string | null;
  origem: string | null;
  destino: string | null;
};

export type CotacaoRow = {
  id: string;
  numero: number;
  cliente_id: string | null;
  oportunidade_id: string | null;
  empresa_nome: string;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  origem_cidade: string | null;
  origem_uf: string | null;
  origem_cep: string | null;
  destino_cidade: string | null;
  destino_uf: string | null;
  destino_cep: string | null;
  tipo_operacao: string;
  tabela_frete_id: string | null;
  tabela_frete_nome: string | null;
  qtd_volumes: number;
  peso: number;
  cubagem: number;
  peso_cubado: number;
  peso_taxado: number;
  valor_mercadoria: number;
  tipo_mercadoria: string | null;
  prazo_dias: number;
  valor_base: number;
  valor_coleta: number;
  valor_entrega: number;
  pedagio: number;
  gris_percentual: number;
  advalorem_percentual: number;
  taxas_extras: number;
  desconto_percentual: number;
  valor_total: number;
  frequencia_mensal: number | null;
  condicao_pagamento: string | null;
  validade_ate: string | null;
  status: string;
  observacoes: string | null;
  responsavel_id: string | null;
  created_at: string;
};

export type PropostaRow = {
  id: string;
  numero: number;
  cotacao_id: string | null;
  cliente_id: string | null;
  oportunidade_id: string | null;
  empresa_nome: string;
  titulo: string;
  escopo: string | null;
  condicoes: string | null;
  condicao_pagamento: string | null;
  validade_ate: string | null;
  valor_total: number;
  status: string;
  enviada_em: string | null;
  visualizada_em: string | null;
  aceita_em: string | null;
  recusada_em: string | null;
  motivo: string | null;
  responsavel_id: string | null;
  minuta_id: string | null;
  created_at: string;
};

const n = (v: unknown, def = 0) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : def;
};
const i = (v: unknown, def = 0) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : def;
};

/* ------------------------------ TABELAS DE FRETE ----------------------------- */

export const listTabelasFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id?: string | null } | undefined) => d ?? {})
  .handler(async ({ context }): Promise<TabelaFreteRow[]> => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("tms_tabela_frete")
      .select("id,nome,cliente_id,origem,destino,tipo_cobranca,valor_coleta,valor_entrega,valor_kg,valor_m3,valor_minimo,prazo_dias")
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as TabelaFreteRow[];
  });

/* ---------------------------------- COTAÇÕES --------------------------------- */

export const listCotacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; cliente_id?: string; meus?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<CotacaoRow[]> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    let q = sb.from("pxsales_cotacoes").select("*").order("created_at", { ascending: false }).limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    if (data.meus) q = q.eq("responsavel_id", userId);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`empresa_nome.ilike.%${s}%,origem_cidade.ilike.%${s}%,destino_cidade.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CotacaoRow[];
  });

export const getCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Cotação não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: cotacao, error } = await sb.from("pxsales_cotacoes").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!cotacao) throw new Error("Cotação não encontrada.");
    const { data: propostas } = await sb
      .from("pxsales_propostas")
      .select("*")
      .eq("cotacao_id", data.id)
      .order("created_at", { ascending: false });
    return { cotacao: cotacao as CotacaoRow, propostas: (propostas ?? []) as PropostaRow[] };
  });

export const saveCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.empresa_nome || !String(d.empresa_nome).trim()) throw new Error("Informe a empresa da cotação.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    let tabela: TabelaFrete | null = null;
    if (data.tabela_frete_id) {
      const { data: t } = await sb
        .from("tms_tabela_frete")
        .select("id,nome,tipo_cobranca,valor_coleta,valor_entrega,valor_kg,valor_m3,valor_minimo,prazo_dias")
        .eq("id", data.tabela_frete_id)
        .maybeSingle();
      tabela = (t ?? null) as TabelaFrete | null;
    }

    const calc = calcularFrete(tabela, {
      peso: n(data.peso),
      cubagem: n(data.cubagem),
      valor_mercadoria: n(data.valor_mercadoria),
      pedagio: n(data.pedagio),
      gris_percentual: n(data.gris_percentual),
      advalorem_percentual: n(data.advalorem_percentual),
      taxas_extras: n(data.taxas_extras),
      desconto_percentual: n(data.desconto_percentual),
    });

    const payload = {
      cliente_id: data.cliente_id || null,
      oportunidade_id: data.oportunidade_id || null,
      lead_id: data.lead_id || null,
      empresa_nome: String(data.empresa_nome).trim(),
      contato_nome: data.contato_nome || null,
      contato_email: data.contato_email || null,
      contato_telefone: data.contato_telefone || null,
      origem_cidade: data.origem_cidade || null,
      origem_uf: data.origem_uf || null,
      origem_cep: data.origem_cep || null,
      destino_cidade: data.destino_cidade || null,
      destino_uf: data.destino_uf || null,
      destino_cep: data.destino_cep || null,
      tipo_operacao: data.tipo_operacao || "transferencia",
      tabela_frete_id: data.tabela_frete_id || null,
      tabela_frete_nome: tabela?.nome ?? null,
      qtd_volumes: i(data.qtd_volumes, 1),
      peso: n(data.peso),
      cubagem: n(data.cubagem),
      peso_cubado: calc.peso_cubado,
      peso_taxado: calc.peso_taxado,
      valor_mercadoria: n(data.valor_mercadoria),
      tipo_mercadoria: data.tipo_mercadoria || null,
      prazo_dias: i(data.prazo_dias, calc.prazo_dias || 1),
      valor_base: calc.valor_base,
      valor_coleta: calc.valor_coleta,
      valor_entrega: calc.valor_entrega,
      pedagio: calc.pedagio,
      gris_percentual: n(data.gris_percentual),
      advalorem_percentual: n(data.advalorem_percentual),
      taxas_extras: calc.taxas_extras,
      desconto_percentual: n(data.desconto_percentual),
      valor_total: calc.valor_total,
      frequencia_mensal: data.frequencia_mensal ? i(data.frequencia_mensal) : null,
      condicao_pagamento: data.condicao_pagamento || null,
      validade_ate: data.validade_ate || null,
      status: data.status || "rascunho",
      observacoes: data.observacoes || null,
      responsavel_id: data.responsavel_id || userId,
      updated_by: userId,
    };

    if (data.id) {
      const { error } = await sb.from("pxsales_cotacoes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    }
    const { data: row, error } = await sb
      .from("pxsales_cotacoes")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setStatusCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => {
    if (!d?.id || !d?.status) throw new Error("Dados incompletos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("pxsales_cotacoes")
      .update({ status: data.status, updated_by: (context as any).userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Cotação não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("pxsales_cotacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- PROPOSTAS -------------------------------- */

async function registrarHistorico(sb: any, propostaId: string, anterior: string | null, novo: string, obs?: string | null) {
  await sb.from("pxsales_proposta_historico").insert({
    proposta_id: propostaId,
    status_anterior: anterior,
    status_novo: novo,
    observacao: obs ?? null,
  });
}

export const listPropostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; meus?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<PropostaRow[]> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    let q = sb.from("pxsales_propostas").select("*").order("created_at", { ascending: false }).limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.meus) q = q.eq("responsavel_id", userId);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`empresa_nome.ilike.%${s}%,titulo.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PropostaRow[];
  });

export const getProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Proposta não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: proposta, error } = await sb.from("pxsales_propostas").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!proposta) throw new Error("Proposta não encontrada.");

    const [{ data: hist }, cot] = await Promise.all([
      sb.from("pxsales_proposta_historico").select("*").eq("proposta_id", data.id).order("created_at", { ascending: false }),
      proposta.cotacao_id
        ? sb.from("pxsales_cotacoes").select("*").eq("id", proposta.cotacao_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    let minuta: any = null;
    if (proposta.minuta_id) {
      const { data: m } = await sb
        .from("tms_minutas")
        .select("id,numero,status,origem,destino,valor_frete,created_at")
        .eq("id", proposta.minuta_id)
        .maybeSingle();
      minuta = m ?? null;
    }

    return {
      proposta: proposta as PropostaRow,
      cotacao: ((cot as any)?.data ?? null) as CotacaoRow | null,
      historico: (hist ?? []) as any[],
      minuta,
    };
  });

/** Gera a proposta a partir de uma cotação (sem redigitar valores). */
export const gerarPropostaDaCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cotacao_id: string; titulo?: string; escopo?: string; condicoes?: string; validade_ate?: string }) => {
    if (!d?.cotacao_id) throw new Error("Cotação não informada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    const { data: c, error: e1 } = await sb.from("pxsales_cotacoes").select("*").eq("id", data.cotacao_id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!c) throw new Error("Cotação não encontrada.");

    const titulo =
      data.titulo?.trim() ||
      `Proposta de frete ${c.origem_cidade ?? "origem"} → ${c.destino_cidade ?? "destino"} — ${c.empresa_nome}`;

    const { data: row, error } = await sb
      .from("pxsales_propostas")
      .insert({
        cotacao_id: c.id,
        cliente_id: c.cliente_id,
        oportunidade_id: c.oportunidade_id,
        empresa_nome: c.empresa_nome,
        titulo,
        escopo:
          data.escopo?.trim() ||
          `Transporte ${c.tipo_operacao} de ${c.origem_cidade ?? "-"}/${c.origem_uf ?? "-"} para ${c.destino_cidade ?? "-"}/${c.destino_uf ?? "-"}, prazo de ${c.prazo_dias} dia(s).`,
        condicoes: data.condicoes ?? null,
        condicao_pagamento: c.condicao_pagamento,
        validade_ate: data.validade_ate || c.validade_ate,
        valor_total: c.valor_total,
        status: "rascunho",
        responsavel_id: c.responsavel_id ?? userId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await registrarHistorico(sb, row.id, null, "rascunho", "Proposta gerada a partir da cotação");
    await sb.from("pxsales_cotacoes").update({ status: "enviada", updated_by: userId }).eq("id", c.id);

    return { id: row.id as string };
  });

export const setStatusProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string; motivo?: string }) => {
    if (!d?.id || !d?.status) throw new Error("Dados incompletos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    const { data: atual } = await sb.from("pxsales_propostas").select("status").eq("id", data.id).maybeSingle();
    const agora = new Date().toISOString();
    const patch: Record<string, any> = { status: data.status, updated_by: userId, motivo: data.motivo ?? null };
    if (data.status === "enviada") patch.enviada_em = agora;
    if (data.status === "visualizada") patch.visualizada_em = agora;
    if (data.status === "aceita") patch.aceita_em = agora;
    if (data.status === "recusada") patch.recusada_em = agora;

    const { error } = await sb.from("pxsales_propostas").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await registrarHistorico(sb, data.id, atual?.status ?? null, data.status, data.motivo);
    return { ok: true };
  });

export const excluirProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Proposta não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("pxsales_propostas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- INTEGRAÇÃO COM O PXLOG -------------------------- */

/**
 * Proposta aceita vira embarque no PXLog: cria a minuta com os dados da cotação,
 * reutilizando o cliente do cadastro único (nunca duplica cliente).
 */
export const enviarPropostaParaPxLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id: string }) => {
    if (!d?.proposta_id) throw new Error("Proposta não informada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ minuta_id: string; numero: number }> => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;

    const { data: p, error: e1 } = await sb.from("pxsales_propostas").select("*").eq("id", data.proposta_id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!p) throw new Error("Proposta não encontrada.");
    if (p.minuta_id) throw new Error("Esta proposta já gerou um embarque no PXLog.");
    if (p.status !== "aceita") throw new Error("Só é possível enviar para a operação depois que a proposta for aceita.");
    if (!p.cotacao_id) throw new Error("A proposta não tem cotação vinculada.");

    const { data: c } = await sb.from("pxsales_cotacoes").select("*").eq("id", p.cotacao_id).maybeSingle();
    if (!c) throw new Error("Cotação da proposta não encontrada.");

    // Cliente do PXLog espelhado do cadastro único
    let tmsClienteId: string | null = null;
    if (p.cliente_id) {
      const { data: tc } = await sb.from("tms_clientes").select("id").eq("registry_id", p.cliente_id).maybeSingle();
      if (tc) tmsClienteId = tc.id;
      else {
        const { data: reg } = await sb
          .from("px_registry_clientes")
          .select("id,razao_social,nome_fantasia,cnpj,cidade,uf,email,telefone")
          .eq("id", p.cliente_id)
          .maybeSingle();
        if (reg) {
          const { data: novo, error: e2 } = await sb
            .from("tms_clientes")
            .insert({
              registry_id: reg.id,
              nome: reg.nome_fantasia || reg.razao_social,
              cnpj: reg.cnpj,
              cidade: reg.cidade,
              uf: reg.uf,
              email: reg.email,
              telefone: reg.telefone,
            })
            .select("id")
            .single();
          if (e2) throw new Error(e2.message);
          tmsClienteId = novo.id;
        }
      }
    }

    const origem = [c.origem_cidade, c.origem_uf].filter(Boolean).join("/") || "Origem a definir";
    const destino = [c.destino_cidade, c.destino_uf].filter(Boolean).join("/") || "Destino a definir";

    const { data: minuta, error: e3 } = await sb
      .from("tms_minutas")
      .insert({
        cliente_id: tmsClienteId,
        remetente: { nome: c.empresa_nome, cidade: c.origem_cidade, uf: c.origem_uf, cep: c.origem_cep },
        destinatario: { nome: "A confirmar", cidade: c.destino_cidade, uf: c.destino_uf, cep: c.destino_cep },
        origem,
        destino,
        qtd_volumes: c.qtd_volumes ?? 1,
        peso: c.peso ?? 0,
        cubagem: c.cubagem ?? 0,
        peso_cubado: c.peso_cubado ?? 0,
        peso_taxado: c.peso_taxado ?? 0,
        valor_mercadoria: c.valor_mercadoria ?? 0,
        tipo_mercadoria: c.tipo_mercadoria,
        valor_frete: p.valor_total ?? c.valor_total ?? 0,
        prazo_dias: c.prazo_dias ?? 1,
        status: "solicitado",
        responsavel_id: userId,
        observacoes: `Origem comercial: proposta PXSales nº ${p.numero}`,
      })
      .select("id,numero")
      .single();
    if (e3) throw new Error(e3.message);

    await sb.from("tms_eventos").insert({
      minuta_id: minuta.id,
      tipo: "solicitado",
      origem_evento: "pxsales",
      operador_id: userId,
      payload: { proposta_id: p.id, proposta_numero: p.numero },
    });

    await sb.from("pxsales_propostas").update({ minuta_id: minuta.id, updated_by: userId }).eq("id", p.id);
    await registrarHistorico(sb, p.id, p.status, "aceita", `Embarque nº ${minuta.numero} criado no PXLog`);

    return { minuta_id: minuta.id as string, numero: minuta.numero as number };
  });
