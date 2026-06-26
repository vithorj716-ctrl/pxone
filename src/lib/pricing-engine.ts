// Pricing Engine — núcleo único de fórmulas do Markup Engine (PXOne)
// Todas as fórmulas ficam aqui. Nada de duplicar lógica em outro lugar.

export interface MarkupInputs {
  custoCompra: number;
  frete: number;
  seguro: number;
  ipi: number; // R$ absoluto
  // Impostos como % sobre o preço de venda
  icmsPct: number;
  pisPct: number;
  cofinsPct: number;
  issPct: number;
  comissaoPct: number;
  taxaCartaoPct: number;
  taxaBancariaPct: number;
  marketplacePct: number;
  // Despesas absolutas
  despAdmin: number;
  despOperacional: number;
  marketing: number;
  despFinanceira: number;
  custosIndiretos: number;
  // Outros
  perdasPct: number;
  lucroDesejadoPct: number;
  margemDesejadaPct: number;
}

export const EMPTY_INPUTS: MarkupInputs = {
  custoCompra: 0, frete: 0, seguro: 0, ipi: 0,
  icmsPct: 0, pisPct: 0, cofinsPct: 0, issPct: 0,
  comissaoPct: 0, taxaCartaoPct: 0, taxaBancariaPct: 0, marketplacePct: 0,
  despAdmin: 0, despOperacional: 0, marketing: 0, despFinanceira: 0, custosIndiretos: 0,
  perdasPct: 0, lucroDesejadoPct: 20, margemDesejadaPct: 30,
};

export interface PricingResult {
  cmv: number;                   // Custo da Mercadoria/Serviço Vendido (absoluto)
  despesasAbs: number;           // Soma das despesas absolutas
  somaPctVenda: number;          // Soma % que incide sobre preço de venda
  custoTotalAbs: number;         // CMV + despesas absolutas (parte fixa)
  precoMinimo: number;           // break-even (lucro 0)
  precoIdeal: number;            // usando margem desejada
  precoSugerido: number;         // usando lucro desejado (markup)
  precoPremium: number;          // +15% sobre o ideal
  precoCompetitivo: number;      // -5% sobre o ideal
  precoPsicologico: number;      // ex: 99,90 abaixo do ideal
  precoMaximo: number;           // teto recomendado (+25%)
  markupPct: number;             // (preço - custo) / custo
  margemPct: number;             // (preço - custoTotal) / preço
  margemContribuicaoPct: number; // (preço - variaveis) / preço
  lucroBruto: number;            // preço - CMV
  lucroLiquido: number;          // preço - tudo
  roiPct: number;                // lucroLiquido / custoTotalAbs
  breakEven: number;             // preço mínimo
}

const ZERO_RESULT: PricingResult = {
  cmv: 0, despesasAbs: 0, somaPctVenda: 0, custoTotalAbs: 0,
  precoMinimo: 0, precoIdeal: 0, precoSugerido: 0, precoPremium: 0,
  precoCompetitivo: 0, precoPsicologico: 0, precoMaximo: 0,
  markupPct: 0, margemPct: 0, margemContribuicaoPct: 0,
  lucroBruto: 0, lucroLiquido: 0, roiPct: 0, breakEven: 0,
};

function precoPsicologicoAjuste(preco: number): number {
  if (preco <= 0) return 0;
  if (preco < 10) return Math.max(0, preco - 0.01);
  const inteiro = Math.floor(preco);
  return inteiro - 0.1; // ex.: 100 -> 99,90
}

export function calcular(inputs: MarkupInputs): PricingResult {
  const i = inputs;
  const cmv = i.custoCompra + i.frete + i.seguro + i.ipi;
  const despesasAbs = i.despAdmin + i.despOperacional + i.marketing + i.despFinanceira + i.custosIndiretos;
  const somaPctVenda =
    (i.icmsPct + i.pisPct + i.cofinsPct + i.issPct +
      i.comissaoPct + i.taxaCartaoPct + i.taxaBancariaPct + i.marketplacePct + i.perdasPct) / 100;

  const custoTotalAbs = cmv + despesasAbs;
  if (custoTotalAbs <= 0) return ZERO_RESULT;

  // Preço mínimo (break-even): preço * (1 - somaPct) = custoTotalAbs
  const denomBreakEven = 1 - somaPctVenda;
  const precoMinimo = denomBreakEven > 0 ? custoTotalAbs / denomBreakEven : custoTotalAbs;

  // Preço ideal por MARGEM desejada: (preço - custoTotal - preço*soma)/preço = margem
  // => preço (1 - margem - soma) = custoTotal => preço = custoTotal / (1 - margem - soma)
  const margem = i.margemDesejadaPct / 100;
  const denomIdeal = 1 - margem - somaPctVenda;
  const precoIdeal = denomIdeal > 0 ? custoTotalAbs / denomIdeal : precoMinimo;

  // Preço sugerido por LUCRO desejado (markup sobre custo):
  // preço = (custoTotal * (1 + lucroDesejado)) / (1 - soma)
  const lucro = i.lucroDesejadoPct / 100;
  const precoSugerido = denomBreakEven > 0
    ? (custoTotalAbs * (1 + lucro)) / denomBreakEven
    : custoTotalAbs * (1 + lucro);

  const precoPremium = precoIdeal * 1.15;
  const precoCompetitivo = precoIdeal * 0.95;
  const precoPsicologico = precoPsicologicoAjuste(precoIdeal);
  const precoMaximo = precoIdeal * 1.25;

  const precoRef = precoSugerido;
  const variaveisAbs = precoRef * somaPctVenda;
  const lucroBruto = precoRef - cmv;
  const lucroLiquido = precoRef - custoTotalAbs - variaveisAbs;
  const markupPct = custoTotalAbs > 0 ? ((precoRef - custoTotalAbs) / custoTotalAbs) * 100 : 0;
  const margemPct = precoRef > 0 ? ((precoRef - custoTotalAbs - variaveisAbs) / precoRef) * 100 : 0;
  const margemContribuicaoPct = precoRef > 0 ? ((precoRef - cmv - variaveisAbs) / precoRef) * 100 : 0;
  const roiPct = custoTotalAbs > 0 ? (lucroLiquido / custoTotalAbs) * 100 : 0;

  return {
    cmv, despesasAbs, somaPctVenda, custoTotalAbs,
    precoMinimo, precoIdeal, precoSugerido, precoPremium, precoCompetitivo,
    precoPsicologico, precoMaximo,
    markupPct, margemPct, margemContribuicaoPct,
    lucroBruto, lucroLiquido, roiPct, breakEven: precoMinimo,
  };
}

export function diagnostico(r: PricingResult): { nivel: "ok" | "alerta" | "critico"; texto: string }[] {
  const out: { nivel: "ok" | "alerta" | "critico"; texto: string }[] = [];
  if (r.precoSugerido <= 0) return [{ nivel: "alerta", texto: "Informe ao menos o custo de compra." }];
  if (r.precoSugerido < r.precoMinimo) out.push({ nivel: "critico", texto: "Preço abaixo do break-even — venda gera prejuízo." });
  if (r.margemPct < 0) out.push({ nivel: "critico", texto: "Margem líquida negativa." });
  else if (r.margemPct < 10) out.push({ nivel: "alerta", texto: `Margem baixa (${r.margemPct.toFixed(1)}%) — abaixo do saudável.` });
  if (r.markupPct > 300) out.push({ nivel: "alerta", texto: `Markup muito alto (${r.markupPct.toFixed(0)}%) — risco competitivo.` });
  if (r.somaPctVenda > 0.45) out.push({ nivel: "alerta", texto: `Impostos + comissões somam ${(r.somaPctVenda * 100).toFixed(1)}% do preço.` });
  if (r.roiPct > 40) out.push({ nivel: "ok", texto: `ROI excelente (${r.roiPct.toFixed(1)}%).` });
  return out;
}
