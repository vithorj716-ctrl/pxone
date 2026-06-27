// Financial Intelligence — núcleo único de cálculo
// Consolida dados existentes (custos, kpi_snapshots, markup, empresas) em
// indicadores executivos: DRE, DFC, Break-Even, Cockpit.

export interface CustoRow {
  id: string;
  data: string;
  valor: number;
  nome: string;
  categoria: string | null;
  centro_custo: string | null;
  tipo_custo: "fixo" | "variavel" | string;
  status: string | null;
  empresa_id: string | null;
}

export interface KpiSnapshot {
  empresa_id: string | null;
  periodo: string;
  receita: number;
  ebitda: number;
  lucro_liquido: number;
  caixa: number;
  capital_giro: number;
  contas_pagar: number;
  contas_receber: number;
  endividamento: number;
  valuation: number;
}

export interface FinancialData {
  custos: CustoRow[];
  snapshots: KpiSnapshot[];
  markupMedio: number;
  empresas: { id: string; nome: string; codigo: string }[];
  metaReceita?: number;
  metaEbitda?: number;
}

// ── Classificação automática de custos ──────────────────────────────────────

export type DreBucket =
  | "devolucoes"
  | "impostos"
  | "custos_operacionais"
  | "despesas_operacionais"
  | "despesas_administrativas"
  | "despesas_financeiras"
  | "depreciacao"
  | "amortizacao";

export function classifyDre(c: CustoRow): DreBucket {
  const t = `${c.categoria ?? ""} ${c.nome ?? ""} ${c.centro_custo ?? ""}`.toLowerCase();
  if (/devolu/.test(t)) return "devolucoes";
  if (/imposto|tribut|icms|iss|pis|cofins|irpj|csll/.test(t)) return "impostos";
  if (/deprecia/.test(t)) return "depreciacao";
  if (/amortiza/.test(t)) return "amortizacao";
  if (/juros|financeir|emprést|emprest|financiamento|bancári|bancari/.test(t)) return "despesas_financeiras";
  if (/admin|escritóri|escritori|jurídic|juridic|contábil|contabil|rh|recursos humanos/.test(t)) return "despesas_administrativas";
  if (/marketing|venda|comercial|publicidade|propaganda/.test(t)) return "despesas_operacionais";
  if (c.tipo_custo === "fixo") return "despesas_operacionais";
  return "custos_operacionais";
}

export type DfcBucket = "operacional" | "investimento" | "financiamento";

export function classifyDfc(c: CustoRow): DfcBucket {
  const t = `${c.categoria ?? ""} ${c.nome ?? ""}`.toLowerCase();
  if (/invest|capex|ativo|aquisi|equipamento|maquin|imóvel|imovel|software/.test(t)) return "investimento";
  if (/emprést|emprest|financiamento|dividend|juros|sócio|socio|aporte|distribu/.test(t)) return "financiamento";
  return "operacional";
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export interface Period { start: Date; end: Date }

export function inPeriod(dateStr: string, p: Period): boolean {
  const d = new Date(dateStr);
  return d >= p.start && d <= p.end;
}

export function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── DRE ─────────────────────────────────────────────────────────────────────

export interface DreResult {
  receitaBruta: number;
  devolucoes: number;
  impostos: number;
  receitaLiquida: number;
  custosOperacionais: number;
  lucroBruto: number;
  despesasOperacionais: number;
  despesasAdministrativas: number;
  despesasFinanceiras: number;
  ebitda: number;
  depreciacao: number;
  amortizacao: number;
  ebit: number;
  resultadoFinanceiro: number;
  lucroAntesIR: number;
  irCsll: number;
  lucroLiquido: number;
  // margens
  margemBruta: number;
  margemEbitda: number;
  margemLiquida: number;
  roi: number;
  roe: number;
}

export function calcDre(data: FinancialData, period: Period, empresaId?: string | null): DreResult {
  const custos = data.custos.filter((c) => inPeriod(c.data, period) && (!empresaId || c.empresa_id === empresaId));
  const snaps = data.snapshots.filter((s) => inPeriod(s.periodo, period) && (!empresaId || s.empresa_id === empresaId));

  const sumBucket = (b: DreBucket) =>
    custos.filter((c) => classifyDre(c) === b).reduce((a, c) => a + Number(c.valor || 0), 0);

  const receitaBruta = snaps.reduce((a, s) => a + Number(s.receita || 0), 0);
  const devolucoes = sumBucket("devolucoes");
  const impostos = sumBucket("impostos");
  const receitaLiquida = receitaBruta - devolucoes - impostos;
  const custosOperacionais = sumBucket("custos_operacionais");
  const lucroBruto = receitaLiquida - custosOperacionais;
  const despesasOperacionais = sumBucket("despesas_operacionais");
  const despesasAdministrativas = sumBucket("despesas_administrativas");
  const despesasFinanceiras = sumBucket("despesas_financeiras");
  const ebitda = lucroBruto - despesasOperacionais - despesasAdministrativas;
  const depreciacao = sumBucket("depreciacao");
  const amortizacao = sumBucket("amortizacao");
  const ebit = ebitda - depreciacao - amortizacao;
  const resultadoFinanceiro = -despesasFinanceiras;
  const lucroAntesIR = ebit + resultadoFinanceiro;
  const irCsll = Math.max(0, lucroAntesIR * 0.34);
  const lucroLiquido = lucroAntesIR - irCsll;

  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemEbitda = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
  const totalCustos = custosOperacionais + despesasOperacionais + despesasAdministrativas + despesasFinanceiras;
  const roi = totalCustos > 0 ? (lucroLiquido / totalCustos) * 100 : 0;
  const patrimonioEstim = snaps.reduce((a, s) => a + Number(s.caixa || 0) + Number(s.capital_giro || 0), 0) || 1;
  const roe = (lucroLiquido / patrimonioEstim) * 100;

  return {
    receitaBruta, devolucoes, impostos, receitaLiquida, custosOperacionais, lucroBruto,
    despesasOperacionais, despesasAdministrativas, despesasFinanceiras, ebitda,
    depreciacao, amortizacao, ebit, resultadoFinanceiro, lucroAntesIR, irCsll, lucroLiquido,
    margemBruta, margemEbitda, margemLiquida, roi, roe,
  };
}

export function dreCascade(d: DreResult): { label: string; value: number; type: "in" | "out" | "total" }[] {
  return [
    { label: "Receita Bruta", value: d.receitaBruta, type: "in" },
    { label: "(-) Devoluções", value: -d.devolucoes, type: "out" },
    { label: "(-) Impostos", value: -d.impostos, type: "out" },
    { label: "Receita Líquida", value: d.receitaLiquida, type: "total" },
    { label: "(-) Custos Operacionais", value: -d.custosOperacionais, type: "out" },
    { label: "Lucro Bruto", value: d.lucroBruto, type: "total" },
    { label: "(-) Desp. Operacionais", value: -d.despesasOperacionais, type: "out" },
    { label: "(-) Desp. Administrativas", value: -d.despesasAdministrativas, type: "out" },
    { label: "EBITDA", value: d.ebitda, type: "total" },
    { label: "(-) Depreciação", value: -d.depreciacao, type: "out" },
    { label: "(-) Amortização", value: -d.amortizacao, type: "out" },
    { label: "EBIT", value: d.ebit, type: "total" },
    { label: "(-) Desp. Financeiras", value: -d.despesasFinanceiras, type: "out" },
    { label: "Lucro Antes IR", value: d.lucroAntesIR, type: "total" },
    { label: "(-) IR/CSLL", value: -d.irCsll, type: "out" },
    { label: "Lucro Líquido", value: d.lucroLiquido, type: "total" },
  ];
}

// ── DFC ─────────────────────────────────────────────────────────────────────

export interface DfcResult {
  entradas: number;
  saidas: number;
  fluxoOperacional: number;
  fluxoInvestimento: number;
  fluxoFinanciamento: number;
  saldoInicial: number;
  saldoFinal: number;
  fluxoLivre: number;
  capitalGiro: number;
  necessidadeCaixa: number;
  saldoProjetado90d: number;
  porMes: { mes: string; entradas: number; saidas: number; saldo: number; acumulado: number }[];
  porDia: { dia: string; entradas: number; saidas: number; saldo: number }[];
}

export function calcDfc(data: FinancialData, period: Period, empresaId?: string | null): DfcResult {
  const custos = data.custos.filter((c) => inPeriod(c.data, period) && (!empresaId || c.empresa_id === empresaId));
  const snaps = data.snapshots.filter((s) => inPeriod(s.periodo, period) && (!empresaId || s.empresa_id === empresaId));

  const entradas = snaps.reduce((a, s) => a + Number(s.receita || 0), 0);
  const saidas = custos.reduce((a, c) => a + Number(c.valor || 0), 0);

  const opOut = custos.filter((c) => classifyDfc(c) === "operacional").reduce((a, c) => a + Number(c.valor || 0), 0);
  const invOut = custos.filter((c) => classifyDfc(c) === "investimento").reduce((a, c) => a + Number(c.valor || 0), 0);
  const finOut = custos.filter((c) => classifyDfc(c) === "financiamento").reduce((a, c) => a + Number(c.valor || 0), 0);

  const fluxoOperacional = entradas - opOut;
  const fluxoInvestimento = -invOut;
  const fluxoFinanciamento = -finOut;
  const fluxoLivre = fluxoOperacional + fluxoInvestimento;

  const sortedSnaps = [...snaps].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const saldoInicial = sortedSnaps[0]?.caixa ?? 0;
  const saldoFinal = sortedSnaps[sortedSnaps.length - 1]?.caixa ?? saldoInicial + fluxoLivre + fluxoFinanciamento;
  const capitalGiro = sortedSnaps[sortedSnaps.length - 1]?.capital_giro ?? 0;
  const contasPagar = sortedSnaps[sortedSnaps.length - 1]?.contas_pagar ?? 0;
  const contasReceber = sortedSnaps[sortedSnaps.length - 1]?.contas_receber ?? 0;
  const necessidadeCaixa = Math.max(0, contasPagar - contasReceber - saldoFinal);

  // por mês
  const mesMap = new Map<string, { entradas: number; saidas: number }>();
  custos.forEach((c) => {
    const k = monthKey(c.data);
    const cur = mesMap.get(k) || { entradas: 0, saidas: 0 };
    cur.saidas += Number(c.valor || 0);
    mesMap.set(k, cur);
  });
  snaps.forEach((s) => {
    const k = monthKey(s.periodo);
    const cur = mesMap.get(k) || { entradas: 0, saidas: 0 };
    cur.entradas += Number(s.receita || 0);
    mesMap.set(k, cur);
  });
  let acumulado = saldoInicial;
  const porMes = Array.from(mesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const saldo = v.entradas - v.saidas;
      acumulado += saldo;
      return { mes, entradas: v.entradas, saidas: v.saidas, saldo, acumulado };
    });

  // por dia (últimos 30)
  const diaMap = new Map<string, { entradas: number; saidas: number }>();
  custos.forEach((c) => {
    const cur = diaMap.get(c.data) || { entradas: 0, saidas: 0 };
    cur.saidas += Number(c.valor || 0);
    diaMap.set(c.data, cur);
  });
  const porDia = Array.from(diaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([dia, v]) => ({ dia, entradas: v.entradas, saidas: v.saidas, saldo: v.entradas - v.saidas }));

  // projeção 90d: média móvel mensal
  const avgMensal = porMes.length > 0 ? porMes.reduce((a, m) => a + m.saldo, 0) / porMes.length : 0;
  const saldoProjetado90d = saldoFinal + avgMensal * 3;

  return {
    entradas, saidas, fluxoOperacional, fluxoInvestimento, fluxoFinanciamento,
    saldoInicial, saldoFinal, fluxoLivre, capitalGiro, necessidadeCaixa, saldoProjetado90d,
    porMes, porDia,
  };
}

// ── Break-Even ──────────────────────────────────────────────────────────────

export interface BreakEvenInputs {
  custosFixos: number;
  custosVariaveis: number;
  receita: number;
  markupPct: number;
  // ajustes simulados
  precoPct?: number;     // +5 → preço 5% maior
  custosPct?: number;    // -10 → custos 10% menor
  vendasPct?: number;    // +20 → 20% mais volume
  impostosPct?: number;
  novosColaboradores?: number;
  custoMedioColab?: number;
}

export interface BreakEvenResult {
  custosFixos: number;
  custosVariaveis: number;
  receita: number;
  margemContribuicao: number;
  margemContribuicaoPct: number;
  peContabil: number;
  peFinanceiro: number;
  peEconomico: number;
  receitaMinima: number;
  diasParaEquilibrio: number;
  margemSeguranca: number;
  gao: number;
  novoLucro: number;
}

export function calcBreakEven(i: BreakEvenInputs): BreakEvenResult {
  const precoMult = 1 + (i.precoPct ?? 0) / 100;
  const custosMult = 1 + (i.custosPct ?? 0) / 100;
  const vendasMult = 1 + (i.vendasPct ?? 0) / 100;
  const impostosExtra = (i.impostosPct ?? 0) / 100;
  const folha = (i.novosColaboradores ?? 0) * (i.custoMedioColab ?? 0);

  const receita = i.receita * precoMult * vendasMult;
  const custosVariaveis = i.custosVariaveis * custosMult * vendasMult + receita * impostosExtra;
  const custosFixos = i.custosFixos * custosMult + folha;

  const mc = receita - custosVariaveis;
  const mcPct = receita > 0 ? mc / receita : 0;
  const peContabil = mcPct > 0 ? custosFixos / mcPct : 0;
  const peFinanceiro = mcPct > 0 ? (custosFixos * 0.9) / mcPct : 0; // - não-caixa
  const peEconomico = mcPct > 0 ? (custosFixos * 1.15) / mcPct : 0; // + custo oportunidade
  const margemSeguranca = receita > 0 ? ((receita - peContabil) / receita) * 100 : 0;
  const novoLucro = receita - custosVariaveis - custosFixos;
  const diasParaEquilibrio = receita > 0 ? Math.ceil((peContabil / receita) * 30) : 0;
  const gao = novoLucro > 0 ? mc / novoLucro : 0;

  return {
    custosFixos, custosVariaveis, receita,
    margemContribuicao: mc, margemContribuicaoPct: mcPct * 100,
    peContabil, peFinanceiro, peEconomico,
    receitaMinima: peContabil, diasParaEquilibrio, margemSeguranca, gao, novoLucro,
  };
}

// ── Resumo agregado para IA (compacto) ──────────────────────────────────────

export function buildExecutiveSummary(data: FinancialData, period: Period, empresaId?: string | null) {
  const dre = calcDre(data, period, empresaId);
  const dfc = calcDfc(data, period, empresaId);
  const be = calcBreakEven({
    custosFixos: data.custos.filter((c) => c.tipo_custo === "fixo").reduce((a, c) => a + Number(c.valor || 0), 0),
    custosVariaveis: data.custos.filter((c) => c.tipo_custo === "variavel").reduce((a, c) => a + Number(c.valor || 0), 0),
    receita: dre.receitaBruta,
    markupPct: data.markupMedio,
  });

  // top 5 categorias de despesa
  const byCat: Record<string, number> = {};
  data.custos.filter((c) => inPeriod(c.data, period)).forEach((c) => {
    const k = c.categoria || "Sem categoria";
    byCat[k] = (byCat[k] || 0) + Number(c.valor || 0);
  });
  const topCategorias = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, valor]) => ({ nome, valor }));

  // variação MoM (últimos 2 meses)
  const meses = dfc.porMes;
  const mom = meses.length >= 2
    ? { receitaMom: meses[meses.length - 1].entradas - meses[meses.length - 2].entradas,
        despesaMom: meses[meses.length - 1].saidas - meses[meses.length - 2].saidas }
    : null;

  return {
    periodo: { inicio: period.start.toISOString().slice(0, 10), fim: period.end.toISOString().slice(0, 10) },
    receita: dre.receitaBruta,
    receitaLiquida: dre.receitaLiquida,
    lucroLiquido: dre.lucroLiquido,
    ebitda: dre.ebitda,
    margens: {
      bruta: Number(dre.margemBruta.toFixed(2)),
      ebitda: Number(dre.margemEbitda.toFixed(2)),
      liquida: Number(dre.margemLiquida.toFixed(2)),
    },
    caixa: { saldoFinal: dfc.saldoFinal, fluxoLivre: dfc.fluxoLivre, projecao90d: dfc.saldoProjetado90d, necessidade: dfc.necessidadeCaixa },
    breakEven: { receitaMinima: be.receitaMinima, margemSeguranca: Number(be.margemSeguranca.toFixed(2)) },
    topCategorias,
    variacaoMoM: mom,
    metaReceita: data.metaReceita ?? null,
    metaEbitda: data.metaEbitda ?? null,
  };
}
