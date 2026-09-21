// Financeiro PX — cadastros e visão geral.
// Toda leitura/escrita passa pela guarda de permissão + escopo de empresa no servidor.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertPermissao, resolveEmpresaId, escopoEmpresas, auditar, empresasPermitidas,
} from "@/lib/financeiro-guard";

type Sb = any;

const num = (v: any) => Number(v ?? 0);

/** Empresas visíveis ao usuário (para o seletor do Financeiro). */
export const finEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as Sb;
    const ids = await empresasPermitidas(sb, context.userId);
    if (!ids.length) return [];
    const { data } = await sb.from("empresas").select("id, nome").in("id", ids).order("nome");
    return (data ?? []) as { id: string; nome: string }[];
  });

/** Visão geral — apenas fatos financeiros (sem DRE/DFC, que continuam na Gestão). */
export const finVisaoGeral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.dashboard.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return null;

    const hoje = new Date().toISOString().slice(0, 10);
    const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const de90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const [cp, cr, mov, saldos, adto] = await Promise.all([
      sb.from("fin_contas_pagar").select("valor, valor_pago, vencimento, status").in("empresa_id", empresas),
      sb.from("fin_contas_receber").select("valor, valor_recebido, vencimento, status").in("empresa_id", empresas),
      sb.from("fin_movimentos").select("tipo, valor, data, estornado_em").in("empresa_id", empresas)
        .is("estornado_em", null).gte("data", de90),
      // Saldo atual = saldo de abertura + TODOS os movimentos já lançados (não apenas 90 dias).
      sb.rpc("fin_saldos", { _empresa_ids: empresas, _de: de90, _ate: hoje }),
      sb.from("fin_adiantamentos").select("valor_pago, valor_acertado, status").in("empresa_id", empresas),
    ]);
    if (saldos.error) throw new Error(saldos.error.message);
    const saldoInfo = (saldos.data ?? {}) as any;

    const pagar = (cp.data ?? []) as any[];
    const receber = (cr.data ?? []) as any[];
    const movs = (mov.data ?? []) as any[];
    const abertoP = pagar.filter((r) => !["pago", "cancelado"].includes(r.status));
    const abertoR = receber.filter((r) => !["recebido", "cancelado"].includes(r.status));
    const saldoP = (r: any) => num(r.valor) - num(r.valor_pago);
    const saldoR = (r: any) => num(r.valor) - num(r.valor_recebido);

    const pagamentosRealizados = movs.filter((m) => m.tipo === "pagamento").reduce((a, b) => a + num(b.valor), 0);
    const recebimentosRealizados = movs.filter((m) => m.tipo === "recebimento").reduce((a, b) => a + num(b.valor), 0);

    // Fluxo previsto por dia (próximos 30 dias)
    const fluxo: { dia: string; entradas: number; saidas: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      fluxo.push({
        dia: d,
        entradas: abertoR.filter((r) => r.vencimento === d).reduce((a, b) => a + saldoR(b), 0),
        saidas: abertoP.filter((r) => r.vencimento === d).reduce((a, b) => a + saldoP(b), 0),
      });
    }

    return {
      // saldo histórico real (abertura + todo o histórico), vindo do banco
      saldo: num(saldoInfo.saldo_consolidado),
      saldoContas: num(saldoInfo.saldo_contas),
      saldoSemConta: num(saldoInfo.saldo_sem_conta),
      aPagar: abertoP.reduce((a, b) => a + saldoP(b), 0),
      aReceber: abertoR.reduce((a, b) => a + saldoR(b), 0),
      pagarHoje: abertoP.filter((r) => r.vencimento === hoje).reduce((a, b) => a + saldoP(b), 0),
      receberHoje: abertoR.filter((r) => r.vencimento === hoje).reduce((a, b) => a + saldoR(b), 0),
      pagarVencido: abertoP.filter((r) => r.vencimento < hoje).reduce((a, b) => a + saldoP(b), 0),
      receberVencido: abertoR.filter((r) => r.vencimento < hoje).reduce((a, b) => a + saldoR(b), 0),
      pagarPrevisto30: abertoP.filter((r) => r.vencimento >= hoje && r.vencimento <= limite).reduce((a, b) => a + saldoP(b), 0),
      receberPrevisto30: abertoR.filter((r) => r.vencimento >= hoje && r.vencimento <= limite).reduce((a, b) => a + saldoR(b), 0),
      pagamentosRealizados,
      recebimentosRealizados,
      adiantamentosAbertos: ((adto.data ?? []) as any[])
        .filter((a) => ["pago", "parcialmente_pago", "parcialmente_acertado"].includes(a.status))
        .reduce((a, b) => a + (num(b.valor_pago) - num(b.valor_acertado)), 0),
      contas: (saldoInfo.contas ?? []) as any[],
      fluxo,
    };
  });

// ---------------- Cadastros ----------------

export const finListarCadastros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return { contas: [], categorias: [], centros: [] };
    const [contas, categorias, centros] = await Promise.all([
      sb.from("fin_contas").select("*").in("empresa_id", empresas).order("nome"),
      sb.from("fin_categorias").select("*").in("empresa_id", empresas).order("nome"),
      sb.from("fin_centros_custo").select("*").in("empresa_id", empresas).order("nome"),
    ]);
    return {
      contas: (contas.data ?? []) as any[],
      categorias: (categorias.data ?? []) as any[],
      centros: (centros.data ?? []) as any[],
    };
  });

export const finSalvarCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tabela: "fin_contas" | "fin_categorias" | "fin_centros_custo"; id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => {
    if (!["fin_contas", "fin_categorias", "fin_centros_custo"].includes(i?.tabela)) throw new Error("Cadastro inválido.");
    if (!i?.payload?.nome) throw new Error("Informe o nome.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.settings.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload = { ...data.payload, empresa_id };
    const q = data.id
      ? sb.from(data.tabela).update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : sb.from(data.tabela).insert({ ...payload, created_by: context.userId }).select("*").maybeSingle();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, data.tabela, row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });

// ---------------- Pessoas (colaboradores / prestadores) ----------------

export const finListarPessoas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { empresaId?: string | null; tipo?: string | null; busca?: string | null }) => i ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.colaboradores.view");
    const empresas = await escopoEmpresas(sb, context.userId, data.empresaId);
    if (!empresas.length) return [];
    let q = sb.from("fin_pessoas").select("*").in("empresa_id", empresas).order("nome");
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.busca) q = q.ilike("nome", `%${data.busca}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const finSalvarPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string | null; empresaId?: string | null; payload: Record<string, any> }) => {
    if (!i?.payload?.nome) throw new Error("Informe o nome.");
    return i;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, context.userId, "financeiro.colaboradores.manage");
    const empresa_id = await resolveEmpresaId(sb, context.userId, data.empresaId);
    const payload = { ...data.payload, empresa_id };
    const { data: row, error } = data.id
      ? await sb.from("fin_pessoas").update(payload).eq("id", data.id).eq("empresa_id", empresa_id).select("*").maybeSingle()
      : await sb.from("fin_pessoas").insert({ ...payload, created_by: context.userId }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await auditar(sb, context.userId, "fin_pessoas", row?.id ?? "", data.id ? "update" : "create", payload);
    return row;
  });
