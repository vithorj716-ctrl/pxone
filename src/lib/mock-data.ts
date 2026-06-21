// Dados mock institucionais — substituídos por dados reais quando os módulos forem alimentados.

export const empresas = [
  { codigo: "PXLOG", nome: "PXLog Logística", setor: "Logística e Transporte", cor: "#10b981" },
  { codigo: "PXMED", nome: "PXMed Serviços Médicos", setor: "Saúde", cor: "#3b82f6" },
  { codigo: "PXFARMA", nome: "PXFarma Distribuidora", setor: "Farmacêutica", cor: "#a855f7" },
];

export const kpiConsolidado = {
  receita: 142_800_000,
  receitaDelta: 12.4,
  ebitda: 34_200_000,
  ebitdaMargem: 24.1,
  valuation: 1_240_000_000,
  caixa: 18_500_000,
  caixaDelta: -4.2,
  capitalGiro: 28_400_000,
  contasPagar: 12_100_000,
  contasReceber: 41_300_000,
  endividamento: 56_700_000,
  liquidez: 1.84,
  crescimento: 18.6,
};

export const performancePorUnidade = [
  { empresa: "PXLog Logística S.A.", receita: 58_200_000, margemEbitda: 18.4, okrStatus: "no_prazo", risco: "baixo" },
  { empresa: "PXMed Serviços Médicos", receita: 44_100_000, margemEbitda: 32.1, okrStatus: "no_prazo", risco: "medio" },
  { empresa: "PXFarma Distribuidora", receita: 40_500_000, margemEbitda: 12.5, okrStatus: "atraso", risco: "alto" },
];

export const evolucaoReceita = [
  { mes: "Jan", receita: 8.2, target: 8.0 },
  { mes: "Fev", receita: 9.1, target: 8.5 },
  { mes: "Mar", receita: 9.8, target: 9.0 },
  { mes: "Abr", receita: 10.4, target: 9.5 },
  { mes: "Mai", receita: 11.2, target: 10.0 },
  { mes: "Jun", receita: 11.8, target: 10.5 },
  { mes: "Jul", receita: 12.6, target: 11.0 },
  { mes: "Ago", receita: 13.2, target: 11.5 },
  { mes: "Set", receita: 13.9, target: 12.0 },
  { mes: "Out", receita: 14.8, target: 12.5 },
  { mes: "Nov", receita: 15.6, target: 13.0 },
  { mes: "Dez", receita: 16.4, target: 13.5 },
];

export const distribuicaoValuation = [
  { empresa: "PXLog", pct: 42, valor: 520_000_000 },
  { empresa: "PXMed", pct: 35, valor: 434_000_000 },
  { empresa: "PXFarma", pct: 23, valor: 285_000_000 },
];

export const decisoesPendentes = [
  {
    titulo: "Aprovação CAPEX PXLog",
    descricao: "Aquisição de nova frota elétrica para unidade Sudeste — R$ 12.4M.",
    destaque: true,
  },
  {
    titulo: "Contratação Head de AI",
    descricao: "Expansão da equipe de análise de dados corporativos.",
    destaque: false,
  },
  {
    titulo: "Redistribuição Dividendos Q3",
    descricao: "Pendente reunião de sócios — agendamento em aberto.",
    destaque: false,
  },
];

export const alertasRisco = [
  { nivel: "alto", titulo: "Liquidez PXFarma", descricao: "Índice abaixo de 1.2 conforme covenant bancário." },
  { nivel: "medio", titulo: "Variação WACC", descricao: "Mudança de juros impactou valuation em +50bps." },
];

export const businessPlans = [
  {
    horizonte: "1 Ano",
    titulo: "Consolidação operacional",
    empresa: "Grupo PX",
    metaReceita: 180_000_000,
    metaEbitda: 48_000_000,
    progresso: 64,
    status: "no_prazo",
  },
  {
    horizonte: "3 Anos",
    titulo: "Expansão regional Nordeste",
    empresa: "PXLog",
    metaReceita: 320_000_000,
    metaEbitda: 78_000_000,
    progresso: 28,
    status: "no_prazo",
  },
  {
    horizonte: "5 Anos",
    titulo: "Verticalização Saúde + Farma",
    empresa: "PXMed / PXFarma",
    metaReceita: 620_000_000,
    metaEbitda: 165_000_000,
    progresso: 12,
    status: "planejamento",
  },
  {
    horizonte: "10 Anos",
    titulo: "Liderança nacional integrada",
    empresa: "Grupo PX",
    metaReceita: 1_800_000_000,
    metaEbitda: 520_000_000,
    progresso: 4,
    status: "visao",
  },
];
