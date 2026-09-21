// Financeiro PX — adiantamentos, folha/pagamentos, recibos, conciliação,
// faturamento (originado da operação) e comissões (apuradas no PXSales).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermissao, resolveEmpresaId, escopoEmpresas, auditar, faixa } from "@/lib/financeiro-guard";

type Sb = any;

// ---------------- Adiantamentos ----------------

export const finListarAdiantamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; status?: string | null; page?: number; pageSize?: number }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.adiantamentos.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { rows: [], total: 0 };
    const { from, to } = faixa(data.page, data.pageSize);
    let q = sb.from("fin_adiantamentos").select("*", { count: "exact" }).in("empresa_id", empresas);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[], total: count ?? 0 };
  });

export const finSalvarAdiantamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => {
    if (!i?.payload?.beneficiario_nome) throw new Error("Informe o beneficiário.");
    if (!(Number(i.payload.valor_solicitado) > 0)) throw new Error("Informe o valor solicitado.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.adiantamentos.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload: Record<string, any> = { ...data.payload, empresa_id };
    delete payload.valor_pago; delete payload.valor_acertado; delete payload.status;
    const { data: row, error } = data.id
      ? await sb.from("fin_adiantamentos").update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : await sb.from("fin_adiantamentos").insert({ ...payload, created_by: context.userId }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_adiantamentos", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

export const finAcaoAdiantamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; acao: "aprovar" | "pagar" | "acertar"; valor?: number | null; contaId?: string | null; forma?: string | null; observacao?: string | null; idempotencyKey?: string | null }) => {
    if (!i?.id || !i?.acao) throw new Error("Ação inválida.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    let res: any;
    if (data.acao === "aprovar") {
      await assertPermissao(sb, context.userId, "financeiro.adiantamentos.approve");
      const r = await sb.rpc("fin_aprovar_adiantamento", { _id: data.id, _valor_aprovado: data.valor ?? null });
      if (r.error) throw new Error(r.error.message);
      res = r.data;
    } else if (data.acao === "pagar") {
      await assertPermissao(sb, context.userId, "financeiro.adiantamentos.manage");
      const r = await sb.rpc("fin_pagar_adiantamento", {
        _id: data.id, _valor: data.valor ?? null, _conta_id: data.contaId ?? null,
        _forma: data.forma ?? null, _data: null, _idempotency_key: data.idempotencyKey ?? null,
      });
      if (r.error) throw new Error(r.error.message);
      res = r.data;
    } else {
      await assertPermissao(sb, context.userId, "financeiro.adiantamentos.manage");
      const r = await sb.rpc("fin_acertar_adiantamento", { _id: data.id, _valor: data.valor ?? 0, _observacao: data.observacao ?? null });
      if (r.error) throw new Error(r.error.message);
      res = r.data;
    }
    await auditar(sb, context.userId, "fin_adiantamentos", data.id, data.acao, { valor: data.valor });
    return res;
  });

// ---------------- Folha / pagamentos ----------------

export const finListarFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; periodoId?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.folha.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { periodos: [], itens: [] };
    const { data: periodos } = await sb.from("fin_folha_periodos").select("*").in("empresa_id", empresas)
      .order("inicio", { ascending: false }).limit(48);
    let itens: any[] = [];
    if (data.periodoId) {
      const { data: rows } = await sb.from("fin_folha_itens")
        .select("*, fin_pessoas(nome, tipo, documento)").eq("periodo_id", data.periodoId);
      itens = (rows ?? []) as any[];
    }
    return { periodos: (periodos ?? []) as any[], itens };
  });

export const finSalvarPeriodoFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; payload: Record<string, any> }) => {
    if (!i?.payload?.referencia) throw new Error("Informe a referência do período (ex.: 2026-09).");
    if (!i?.payload?.inicio || !i?.payload?.fim) throw new Error("Informe o período.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.folha.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const { data: row, error } = await sb.from("fin_folha_periodos")
      .insert({ ...data.payload, empresa_id, created_by: context.userId }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_folha_periodos", row?.id ?? "", "create", data.payload);
    return row;
  });

export const finSalvarItemFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; periodoId: string; empresaId?: string | null; payload: Record<string, any> }) => {
    if (!i?.periodoId) throw new Error("Período não informado.");
    if (!i?.payload?.pessoa_id) throw new Error("Selecione a pessoa.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.folha.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const p = data.payload;
    const liquido = Number(p.valor_base ?? 0) + Number(p.adicionais ?? 0) + Number(p.ajustes ?? 0)
      - Number(p.descontos ?? 0) - Number(p.adiantamentos ?? 0);
    const payload = { ...p, empresa_id, periodo_id: data.periodoId, valor_liquido: liquido };
    const { data: row, error } = data.id
      ? await sb.from("fin_folha_itens").update(payload).eq("id", data.id).select("*").maybeSingle()
      : await sb.from("fin_folha_itens").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_folha_itens", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

/** Gera um título a pagar para cada item aprovado do período (idempotente por item). */
export const finGerarPagamentosFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { periodoId: string; empresaId?: string | null; vencimento?: string | null }) => {
    if (!i?.periodoId) throw new Error("Período não informado.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.folha.approve");
    // Tudo em uma única transação no banco: ou gera todos os títulos ou nenhum.
    const { data: res, error } = await sb.rpc("fin_gerar_pagamentos_folha", {
      _periodo_id: data.periodoId, _vencimento: data.vencimento ?? null,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as { criados?: number; existentes?: number };
    await auditar(sb, context.userId, "fin_folha_periodos", data.periodoId, "gerar_pagamentos", out);
    return { criados: out.criados ?? 0, existentes: out.existentes ?? 0 };
  });

// ---------------- Recibos ----------------

export const finListarRecibos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; page?: number; pageSize?: number }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.recibos.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { rows: [], total: 0 };
    const { from, to } = faixa(data.page, data.pageSize);
    const { data: rows, error, count } = await sb.from("fin_recibos").select("*", { count: "exact" })
      .in("empresa_id", empresas).order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[], total: count ?? 0 };
  });

export const finEmitirRecibo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; tipo?: string; beneficiario?: string | null; documento?: string | null; descricao: string; valor?: number | null; data?: string | null; forma?: string | null; origemTipo?: string | null; origemId?: string | null; movimentoId?: string | null; reemissaoDe?: string | null; justificativa?: string | null }) => {
    if (!i?.descricao?.trim()) throw new Error("Informe a descrição.");
    if (!i?.movimentoId) {
      // Recibo manual: precisa de beneficiário, valor e justificativa.
      if (!i?.beneficiario?.trim()) throw new Error("Informe o beneficiário.");
      if (!(Number(i.valor) > 0)) throw new Error("Informe um valor maior que zero.");
      if (!i?.justificativa?.trim()) throw new Error("Recibo sem movimento financeiro exige justificativa.");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.recibos.generate");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const { data: res, error } = await sb.rpc("fin_emitir_recibo", {
      _empresa_id: empresa_id, _tipo: data.tipo ?? "pagamento", _beneficiario: data.beneficiario ?? null,
      _documento: data.documento ?? null, _descricao: data.descricao, _valor: data.valor ?? null,
      _data: data.data ?? null, _forma: data.forma ?? null, _origem_tipo: data.origemTipo ?? null,
      _origem_id: data.origemId ?? null, _movimento_id: data.movimentoId ?? null,
      _reemissao_de: data.reemissaoDe ?? null, _justificativa: data.justificativa ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_recibos", String((res as any)?.recibo_id ?? ""), "emissao", { valor: data.valor });
    return res;
  });

// ---------------- Faturamento ----------------

/** Minutas entregues e ainda não faturadas — origem única: PXLog/TMS. */
export const finFaturamentoElegivel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.faturamento.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { elegiveis: [], faturados: [] };
    const [el, fat] = await Promise.all([
      sb.from("tms_minutas")
        .select("id, numero, status, status_financeiro, valor_frete, origem, destino, empresa_id, tms_clientes(nome)")
        .in("empresa_id", empresas).eq("status", "entregue").neq("status_financeiro", "faturado")
        .order("created_at", { ascending: false }).limit(300),
      sb.from("fin_faturamentos").select("*").in("empresa_id", empresas)
        .order("created_at", { ascending: false }).limit(300),
    ]);
    return { elegiveis: (el.data ?? []) as any[], faturados: (fat.data ?? []) as any[] };
  });

export const finFaturarMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { minutaId: string; vencimento?: string | null; contaId?: string | null; empresaId?: string | null }) => {
    if (!i?.minutaId) throw new Error("Minuta não informada.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.faturamento.manage");
    const { data: res, error } = await sb.rpc("fin_faturar_minuta", {
      _minuta_id: data.minutaId, _vencimento: data.vencimento ?? null,
      _conta_id: data.contaId ?? null, _empresa_id: data.empresaId ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_faturamentos", String((res as any)?.faturamento_id ?? ""), "faturamento", { minuta: data.minutaId });
    return res;
  });

// ---------------- Comissões (fila de pagamento) ----------------

export const finListarComissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; status?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.comissoes.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { rows: [], titulos: [] };
    let q = sb.from("pxsales_comissoes").select("*").in("empresa_id", empresas);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const ids = ((rows ?? []) as any[]).map((r) => r.id);
    const { data: titulos } = ids.length
      ? await sb.from("fin_contas_pagar").select("id, origem_id, status, valor, vencimento, valor_pago")
          .eq("origem_tipo", "comissao").in("origem_id", ids)
      : { data: [] };
    return { rows: (rows ?? []) as any[], titulos: (titulos ?? []) as any[] };
  });

export const finAgendarComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { comissaoId: string; vencimento?: string | null }) => {
    if (!i?.comissaoId) throw new Error("Comissão não informada.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.comissoes.pay");
    const { data: res, error } = await sb.rpc("fin_agendar_comissao", {
      _comissao_id: data.comissaoId, _vencimento: data.vencimento ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "pxsales_comissoes", data.comissaoId, "agendar_pagamento", {});
    return res;
  });

// ---------------- Conciliação ----------------

export const finListarConciliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; status?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.conciliacao.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { rows: [], movimentos: [] };
    let q = sb.from("fin_conciliacao").select("*").in("empresa_id", empresas);
    if (data.status) q = q.eq("status", data.status);
    const [conc, mov] = await Promise.all([
      q.order("data", { ascending: false }).limit(300),
      sb.from("fin_movimentos").select("id, tipo, valor, data, documento").in("empresa_id", empresas)
        .is("estornado_em", null).order("data", { ascending: false }).limit(300),
    ]);
    return { rows: (conc.data ?? []) as any[], movimentos: (mov.data ?? []) as any[] };
  });

export const finSalvarConciliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => {
    if (!i?.payload?.conta_id) throw new Error("Selecione a conta financeira.");
    if (!i?.payload?.data) throw new Error("Informe a data.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.conciliacao.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload: Record<string, any> = { ...data.payload, empresa_id };
    if (payload.status === "conciliado") {
      payload.conciliado_por = context.userId;
      payload.conciliado_em = new Date().toISOString();
    }
    const { data: row, error } = data.id
      ? await sb.from("fin_conciliacao").update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : await sb.from("fin_conciliacao").insert(payload).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_conciliacao", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

// ---------------- Relatórios financeiros ----------------

export const finRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; tipo: "pagar" | "receber" | "movimentos" | "inadimplencia"; de?: string | null; ate?: string | null }) => {
    if (!i?.tipo) throw new Error("Selecione o relatório.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.relatorios.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return [];
    const hoje = new Date().toISOString().slice(0, 10);
    if (data.tipo === "movimentos") {
      let q = sb.from("fin_movimentos").select("*").in("empresa_id", empresas).is("estornado_em", null);
      if (data.de) q = q.gte("data", data.de);
      if (data.ate) q = q.lte("data", data.ate);
      return ((await q.order("data")).data ?? []) as any[];
    }
    const tabela = data.tipo === "pagar" ? "fin_contas_pagar" : "fin_contas_receber";
    let q = sb.from(tabela).select("*").in("empresa_id", empresas);
    if (data.de) q = q.gte("vencimento", data.de);
    if (data.ate) q = q.lte("vencimento", data.ate);
    if (data.tipo === "inadimplencia") q = q.lt("vencimento", hoje).in("status", ["aberto", "vencido", "parcialmente_recebido"]);
    return ((await q.order("vencimento")).data ?? []) as any[];
  });
