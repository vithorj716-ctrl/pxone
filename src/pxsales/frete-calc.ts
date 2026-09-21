// PXSales — Etapa 4: cálculo de frete reaproveitando a tabela de frete do PXLog.
// Função pura: usada tanto na tela (prévia em tempo real) quanto no servidor (valor gravado).

export const FATOR_CUBAGEM = 300; // kg por m³ — padrão rodoviário usado na operação

export type TabelaFrete = {
  id: string;
  nome: string;
  tipo_cobranca: string;
  valor_coleta: number;
  valor_entrega: number;
  valor_kg: number;
  valor_m3: number;
  valor_minimo: number;
  prazo_dias: number;
};

export type EntradaFrete = {
  peso: number;
  cubagem: number;
  valor_mercadoria: number;
  pedagio: number;
  gris_percentual: number;
  advalorem_percentual: number;
  taxas_extras: number;
  desconto_percentual: number;
  qtd_volumes: number;
};

export type ComposicaoFrete = {
  peso_cubado: number;
  peso_taxado: number;
  valor_base: number;
  valor_coleta: number;
  valor_entrega: number;
  pedagio: number;
  gris: number;
  advalorem: number;
  taxas_extras: number;
  subtotal: number;
  desconto: number;
  valor_total: number;
  aplicou_minimo: boolean;
  prazo_dias: number;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

import { calcularTabelaFrete, type RegraComercial } from "@/pxlog/regra-engine";

export function calcularFrete(
  tabela: TabelaFrete | null,
  entrada: Partial<EntradaFrete>,
  regras?: RegraComercial[] | null,
): ComposicaoFrete {
  const peso = num(entrada.peso);
  const cubagem = num(entrada.cubagem);
  const pesoCubado = r2(cubagem * FATOR_CUBAGEM);
  const pesoTaxado = r2(Math.max(peso, pesoCubado));

  const kg = num(tabela?.valor_kg);
  const m3 = num(tabela?.valor_m3);
  const tipo = tabela?.tipo_cobranca ?? "peso";

  // Quando a tabela possui regras comerciais estruturadas, o motor único define a base.
  if (regras && regras.length) {
    const eng = calcularTabelaFrete(regras, {
      peso, peso_taxado: pesoTaxado, cubagem,
      volumes: num(entrada.qtd_volumes ?? 1),
      valor_nota: num(entrada.valor_mercadoria),
    });
    const pedagioM = num(entrada.pedagio);
    const mercM = num(entrada.valor_mercadoria);
    const grisM = r2((mercM * num(entrada.gris_percentual)) / 100);
    const advM = r2((mercM * num(entrada.advalorem_percentual)) / 100);
    const taxasM = num(entrada.taxas_extras);
    const sub = r2(eng.total + pedagioM + grisM + advM + taxasM);
    const desc = r2((sub * num(entrada.desconto_percentual)) / 100);
    return {
      peso_cubado: pesoCubado,
      peso_taxado: pesoTaxado,
      valor_base: eng.frete_base,
      valor_coleta: 0,
      valor_entrega: 0,
      pedagio: pedagioM,
      gris: grisM,
      advalorem: advM,
      taxas_extras: r2(taxasM + eng.adicionais),
      subtotal: sub,
      desconto: desc,
      valor_total: r2(Math.max(0, sub - desc)),
      aplicou_minimo: eng.minimo_aplicado !== null,
      prazo_dias: tabela?.prazo_dias ?? 1,
    };
  }

  let base = 0;
  if (tipo === "cubagem") base = m3 * cubagem;
  else if (tipo === "maior") base = Math.max(kg * pesoTaxado, m3 * cubagem);
  else base = kg * pesoTaxado;

  const minimo = num(tabela?.valor_minimo);
  const aplicouMinimo = minimo > 0 && base < minimo;
  if (aplicouMinimo) base = minimo;

  const coleta = num(tabela?.valor_coleta);
  const entregaV = num(tabela?.valor_entrega);
  const pedagio = num(entrada.pedagio);
  const merc = num(entrada.valor_mercadoria);
  const gris = r2((merc * num(entrada.gris_percentual)) / 100);
  const adv = r2((merc * num(entrada.advalorem_percentual)) / 100);
  const taxas = num(entrada.taxas_extras);

  const subtotal = r2(base + coleta + entregaV + pedagio + gris + adv + taxas);
  const desconto = r2((subtotal * num(entrada.desconto_percentual)) / 100);

  return {
    peso_cubado: pesoCubado,
    peso_taxado: pesoTaxado,
    valor_base: r2(base),
    valor_coleta: coleta,
    valor_entrega: entregaV,
    pedagio,
    gris,
    advalorem: adv,
    taxas_extras: taxas,
    subtotal,
    desconto,
    valor_total: r2(Math.max(0, subtotal - desconto)),
    aplicou_minimo: aplicouMinimo,
    prazo_dias: tabela?.prazo_dias ?? 1,
  };
}

export const STATUS_COTACAO = [
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "aprovada", label: "Aprovada" },
  { value: "recusada", label: "Recusada" },
  { value: "expirada", label: "Expirada" },
] as const;

export const STATUS_PROPOSTA = [
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "visualizada", label: "Visualizada" },
  { value: "negociacao", label: "Em negociação" },
  { value: "aceita", label: "Aceita" },
  { value: "recusada", label: "Recusada" },
  { value: "expirada", label: "Expirada" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export const TIPOS_OPERACAO = [
  "transferencia",
  "distribuicao",
  "coleta",
  "dedicado",
  "lastmile",
  "armazenagem",
] as const;
