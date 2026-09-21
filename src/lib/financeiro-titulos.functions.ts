// Financeiro PX — contas a pagar, contas a receber, pagamentos e recebimentos.
// Baixas, cancelamentos e estornos passam por RPC transacional no banco.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermissao, resolveEmpresaId, escopoEmpresas, auditar, faixa } from "@/lib/financeiro-guard";

type Sb = any;
type Filtro = {
  empresaId?: string | null;
  status?: string | null;
  de?: string | null;
  ate?: string | null;
  busca?: string | null;
  categoriaId?: string | null;
  centroCustoId?: string | null;
  page?: number;
  pageSize?: number;
};

async function listar(sb: Sb, userId: string, tabela: string, acao: any, f: Filtro) {
  await assertPermissao(sb, userId, acao);
  const empresas = await escopoEmpresas(sb, userId, f.empresaId);
  if (!empresas.length) return { rows: [], total: 0, totais: { aberto: 0, vencido: 0, hoje: 0 } };
  const { from, to } = faixa(f.page, f.pageSize);
  let q = sb.from(tabela).select("*", { count: "exact" }).in("empresa_id", empresas);
  if (f.status) q = q.eq("status", f.status);
  if (f.de) q = q.gte("vencimento", f.de);
  if (f.ate) q = q.lte("vencimento", f.ate);
  if (f.categoriaId) q = q.eq("categoria_id", f.categoriaId);
  if (f.centroCustoId) q = q.eq("centro_custo_id", f.centroCustoId);
  if (f.busca) q = q.ilike("descricao", `%${f.busca}%`);
  const { data, error, count } = await q.order("vencimento", { ascending: true }).range(from, to);
  if (error) throw new Error(error.message);

  const hoje = new Date().toISOString().slice(0, 10);
  const pagos = tabela === "fin_contas_pagar" ? "valor_pago" : "valor_recebido";
  const fechado = tabela === "fin_contas_pagar" ? "pago" : "recebido";
  const rows = (data ?? []) as any[];
  const abertos = rows.filter((r) => ![fechado, "cancelado"].includes(r.status));
  const saldo = (r: any) => Number(r.valor ?? 0) - Number(r[pagos] ?? 0);
  return {
    rows,
    total: count ?? rows.length,
    totais: {
      aberto: abertos.reduce((a, b) => a + saldo(b), 0),
      vencido: abertos.filter((r) => r.vencimento < hoje).reduce((a, b) => a + saldo(b), 0),
      hoje: abertos.filter((r) => r.vencimento === hoje).reduce((a, b) => a + saldo(b), 0),
    },
  };
}

export const finListarPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Filtro) => i ?? {})
  .handler(({ data, context }) => listar(context.supabase, context.userId, "fin_contas_pagar", "financeiro.contas_pagar.view", data));

export const finListarReceber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Filtro) => i ?? {})
  .handler(({ data, context }) => listar(context.supabase, context.userId, "fin_contas_receber", "financeiro.contas_receber.view", data));

function validarTitulo(i: any) {
  if (!i?.payload?.descricao) throw new Error("Informe a descrição.");
  if (!(Number(i.payload.valor) > 0)) throw new Error("Informe um valor maior que zero.");
  if (!i.payload.vencimento) throw new Error("Informe o vencimento.");
  return i;
}

export const finSalvarPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => validarTitulo(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.contas_pagar.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload = { ...data.payload, empresa_id };
    delete payload.valor_pago; delete payload.status_forcado;
    const { data: row, error } = data.id
      ? await sb.from("fin_contas_pagar").update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : await sb.from("fin_contas_pagar").insert({ ...payload, created_by: context.userId }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_contas_pagar", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

export const finSalvarReceber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => validarTitulo(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.contas_receber.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload = { ...data.payload, empresa_id };
    delete payload.valor_recebido;
    const { data: row, error } = data.id
      ? await sb.from("fin_contas_receber").update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : await sb.from("fin_contas_receber").insert({ ...payload, created_by: context.userId }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_contas_receber", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

export const finPagar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; valor: number; data?: string; contaId?: string | null; forma?: string | null; documento?: string | null; observacao?: string | null; idempotencyKey?: string | null }) => {
    if (!i?.id) throw new Error("Título não informado.");
    if (!(Number(i.valor) > 0)) throw new Error("Informe um valor maior que zero.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.pagamentos.manage");
    const { data: res, error } = await sb.rpc("fin_registrar_pagamento", {
      _conta_pagar_id: data.id, _valor: data.valor, _data: data.data ?? null,
      _conta_id: data.contaId ?? null, _forma: data.forma ?? null,
      _documento: data.documento ?? null, _observacao: data.observacao ?? null,
      _idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_contas_pagar", data.id, "pagamento", { valor: data.valor });
    return res;
  });

export const finReceber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; valor: number; data?: string; contaId?: string | null; forma?: string | null; documento?: string | null; observacao?: string | null; idempotencyKey?: string | null }) => {
    if (!i?.id) throw new Error("Título não informado.");
    if (!(Number(i.valor) > 0)) throw new Error("Informe um valor maior que zero.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.recebimentos.manage");
    const { data: res, error } = await sb.rpc("fin_registrar_recebimento", {
      _conta_receber_id: data.id, _valor: data.valor, _data: data.data ?? null,
      _conta_id: data.contaId ?? null, _forma: data.forma ?? null,
      _documento: data.documento ?? null, _observacao: data.observacao ?? null,
      _idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_contas_receber", data.id, "recebimento", { valor: data.valor });
    return res;
  });

export const finCancelarTitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { entidade: "conta_pagar" | "conta_receber"; id: string; motivo: string }) => {
    if (!i?.motivo?.trim()) throw new Error("Informe o motivo do cancelamento.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const { error } = await sb.rpc("fin_cancelar_titulo", { _entidade: data.entidade, _id: data.id, _motivo: data.motivo });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, data.entidade, data.id, "cancelamento", { motivo: data.motivo });
    return { ok: true };
  });

export const finEstornarMovimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { movimentoId: string; motivo: string }) => {
    if (!i?.motivo?.trim()) throw new Error("Informe o motivo do estorno.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const { error } = await sb.rpc("fin_estornar_movimento", { _movimento_id: data.movimentoId, _motivo: data.motivo });
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_movimentos", data.movimentoId, "estorno", { motivo: data.motivo });
    return { ok: true };
  });

export const finListarMovimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; tipo?: "pagamento" | "recebimento" | null; de?: string | null; ate?: string | null; page?: number; pageSize?: number }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, data.tipo === "recebimento" ? "financeiro.recebimentos.view" : "financeiro.pagamentos.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { rows: [], total: 0 };
    const { from, to } = faixa(data.page, data.pageSize);
    let q = sb.from("fin_movimentos").select("*", { count: "exact" }).in("empresa_id", empresas);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.de) q = q.gte("data", data.de);
    if (data.ate) q = q.lte("data", data.ate);
    const { data: rows, error, count } = await q.order("data", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[], total: count ?? 0 };
  });

export const finHistoricoTitulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { entidade: string; id: string }) => i)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.view");
    const { data: rows } = await sb.from("fin_lancamento_historico").select("*")
      .eq("entidade", data.entidade).eq("entidade_id", data.id).order("created_at", { ascending: false }).limit(100);
    return (rows ?? []) as any[];
  });

export const finMarcarVencidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const { data: res, error } = await sb.rpc("fin_marcar_vencidos", { _empresa_id: empresa_id });
    if (error) throw new Error(error.message);
    return res;
  });
