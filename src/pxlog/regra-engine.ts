// Motor ÚNICO de cálculo das tabelas comerciais de frete do PXLog/PXSales.
// A fórmula vem SEMPRE da configuração estruturada da regra — nunca do nome dela.

import { numOuNulo } from "./num";
import {
  avaliarRegra,
  calcularKernel,
  type BaseKernel,
  type GrupoRegra,
  type LinhaKernel,
  type ModoRegra,
  type ContextoKernel,
  type RegraKernel,
} from "@/pxsales/calc-kernel";

export type ModoCobranca =
  | "valor_fixo"
  | "percentual"
  | "por_kg"
  | "por_m3"
  | "por_km"
  | "por_volume"
  | "faixa"
  | "minimo";

export type BaseCalculo =
  | "nenhuma"
  | "valor_nota"
  | "valor_frete"
  | "subtotal"
  | "peso"
  | "peso_taxado"
  | "cubagem"
  | "volumes"
  | "distancia";

export type TipoRegra = "frete" | "adicional" | "taxa" | "servico" | "minimo" | "desconto";

export type FaixaRegra = {
  min: number | null;
  max: number | null;
  modo: Exclude<ModoCobranca, "faixa" | "minimo">;
  valor: number | null;
};

export type RegraComercial = {
  id?: string;
  nome: string;
  tipo: TipoRegra | string;
  modo: ModoCobranca | string;
  valor: number | null;
  unidade?: string | null;
  base_calculo: BaseCalculo | string;
  servico_id?: string | null;
  servico_nome?: string | null;
  rota_id?: string | null;
  faixa_campo?: string | null;
  faixa_min?: number | null;
  faixa_max?: number | null;
  valor_minimo?: number | null;
  valor_maximo?: number | null;
  ordem?: number | null;
  ativo?: boolean;
  config?: Record<string, unknown> | null;
};

export type ContextoFrete = {
  cliente_id?: string | null;
  origem?: string | null;
  destino?: string | null;
  rota_id?: string | null;
  peso?: number | null;
  peso_taxado?: number | null;
  cubagem?: number | null;
  volumes?: number | null;
  valor_nota?: number | null;
  distancia_km?: number | null;
};

export type LinhaCalculo = {
  regra_id: string | null;
  nome: string;
  tipo: string;
  modo: string;
  base_calculo: string;
  base: number;
  parametro: number | null;
  valor: number;
};

export type ResultadoFrete = {
  linhas: LinhaCalculo[];
  frete_base: number;
  adicionais: number;
  subtotal: number;
  minimo_aplicado: number | null;
  total: number;
  avisos: string[];
};

export const MODOS: { value: ModoCobranca; label: string; exigeBase: boolean }[] = [
  { value: "valor_fixo", label: "Valor fixo", exigeBase: false },
  { value: "percentual", label: "Percentual", exigeBase: true },
  { value: "por_kg", label: "Por kg", exigeBase: false },
  { value: "por_m3", label: "Por m³", exigeBase: false },
  { value: "por_km", label: "Por km", exigeBase: false },
  { value: "por_volume", label: "Por volume", exigeBase: false },
  { value: "faixa", label: "Por faixa", exigeBase: false },
  { value: "minimo", label: "Valor mínimo (piso)", exigeBase: false },
];

export const BASES: { value: BaseCalculo; label: string }[] = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "valor_nota", label: "Valor da nota" },
  { value: "valor_frete", label: "Valor do frete" },
  { value: "subtotal", label: "Subtotal acumulado" },
  { value: "peso", label: "Peso" },
  { value: "peso_taxado", label: "Peso taxado" },
  { value: "cubagem", label: "Cubagem" },
  { value: "volumes", label: "Quantidade de volumes" },
  { value: "distancia", label: "Distância" },
];

export const TIPOS_REGRA: { value: TipoRegra; label: string }[] = [
  { value: "frete", label: "Frete" },
  { value: "adicional", label: "Adicional" },
  { value: "taxa", label: "Taxa" },
  { value: "servico", label: "Serviço" },
  { value: "desconto", label: "Desconto" },
  { value: "minimo", label: "Frete mínimo" },
];

const n0 = (v: unknown) => numOuNulo(v) ?? 0;

const MODO_KERNEL: Record<string, ModoRegra> = {
  valor_fixo: "fixo",
  fixo: "fixo",
  percentual: "percentual",
  por_kg: "por_kg",
  por_ton: "por_ton",
  por_m3: "por_m3",
  por_km: "por_km",
  por_volume: "por_volume",
  por_eixo: "por_eixo",
  por_100kg: "por_100kg",
  faixa: "faixa",
  minimo: "minimo",
};

const BASE_KERNEL: Record<string, BaseKernel> = {
  nenhuma: "nenhuma",
  valor_nota: "valor_mercadoria",
  valor_mercadoria: "valor_mercadoria",
  valor_frete: "valor_frete",
  subtotal: "subtotal",
  peso: "peso",
  peso_taxado: "peso_taxado",
  cubagem: "cubagem",
  volumes: "volumes",
  distancia: "distancia",
};

const BASE_LEGADO: Record<string, string> = { valor_mercadoria: "valor_nota" };
const MODO_LEGADO: Record<string, string> = { fixo: "valor_fixo" };

const grupoDe = (tipo: unknown): GrupoRegra => {
  const t = String(tipo ?? "taxa");
  return (["frete", "adicional", "taxa", "servico", "desconto", "minimo"] as const).includes(t as GrupoRegra)
    ? (t as GrupoRegra)
    : "taxa";
};

/** Converte a regra comercial (formato legado do PXLog) para o motor único. */
export function paraKernel(regra: RegraComercial): RegraKernel {
  const modo = MODO_KERNEL[String(regra.modo)] ?? ("desconhecido" as ModoRegra);
  const base = BASE_KERNEL[String(regra.base_calculo ?? "nenhuma")] ?? "nenhuma";
  const faixasCfg = (regra.config?.["faixas"] as FaixaRegra[] | undefined) ?? [];
  return {
    id: regra.id ?? null,
    codigo: regra.nome,
    nome: regra.nome,
    grupo: grupoDe(regra.tipo),
    modo,
    valor: numOuNulo(regra.valor),
    base,
    unidade: regra.unidade ?? null,
    faixas: faixasCfg.map((f) => ({
      min: numOuNulo(f.min),
      max: numOuNulo(f.max),
      modo: MODO_KERNEL[String(f.modo)] ?? "fixo",
      valor: numOuNulo(f.valor),
      max_inclusive: true,
    })),
    faixa_campo: regra.faixa_campo ? (BASE_KERNEL[String(regra.faixa_campo)] ?? null) : null,
    faixa_min: numOuNulo(regra.faixa_min),
    faixa_max: numOuNulo(regra.faixa_max),
    rota_id: regra.rota_id ?? null,
    piso: numOuNulo(regra.valor_minimo),
    teto: numOuNulo(regra.valor_maximo),
    ordem: regra.ordem ?? 100,
    ativo: regra.ativo !== false,
    aplicar_em: "total",
  };
}

function paraContexto(ctx: ContextoFrete): ContextoKernel {
  return {
    peso: ctx.peso ?? null,
    peso_taxado: ctx.peso_taxado ?? ctx.peso ?? null,
    cubagem: ctx.cubagem ?? null,
    volumes: ctx.volumes ?? null,
    valor_mercadoria: ctx.valor_nota ?? null,
    distancia_km: ctx.distancia_km ?? null,
    rota_id: ctx.rota_id ?? null,
  };
}

function paraLinha(l: LinhaKernel): LinhaCalculo {
  return {
    regra_id: l.regra_id,
    nome: l.nome,
    tipo: l.grupo,
    modo: MODO_LEGADO[l.modo] ?? l.modo,
    base_calculo: BASE_LEGADO[l.base_calculo] ?? l.base_calculo,
    base: l.base,
    parametro: l.parametro,
    valor: l.valor,
  };
}

/** Compatibilidade: cálculo de uma regra isolada pelo motor único. */
export function calcularRegra(
  regra: RegraComercial,
  ctx: ContextoFrete,
  acum: { frete: number; subtotal: number },
  avisos: string[],
): LinhaCalculo | null {
  const linha = avaliarRegra(paraKernel(regra), paraContexto(ctx), acum, avisos);
  return linha ? paraLinha(linha) : null;
}

/** Tabela legada do PXLog avaliada pelo motor único do Grupo PX. */
export function calcularTabelaFrete(regras: RegraComercial[], ctx: ContextoFrete): ResultadoFrete {
  const res = calcularKernel((regras ?? []).map(paraKernel), paraContexto(ctx));
  return {
    linhas: res.linhas.map(paraLinha),
    frete_base: res.frete_calculado,
    adicionais: res.adicionais,
    subtotal: res.subtotal,
    minimo_aplicado: res.minimo_aplicado,
    total: res.total,
    avisos: res.avisos,
  };
}

/** Converte os campos legados de tms_tabela_frete em regras estruturadas equivalentes. */
export function regrasLegado(t: Record<string, unknown>): RegraComercial[] {
  const out: RegraComercial[] = [];
  const tipo = String(t["tipo_cobranca"] ?? "peso");
  const kg = numOuNulo(t["valor_kg"]);
  const m3 = numOuNulo(t["valor_m3"]);
  if (kg !== null && (tipo === "peso" || tipo === "mista" || tipo === "maior"))
    out.push({ nome: "Frete por peso", tipo: "frete", modo: "por_kg", valor: kg, base_calculo: "peso_taxado", ordem: 10 });
  if (m3 !== null && (tipo === "cubagem" || tipo === "mista" || tipo === "maior"))
    out.push({ nome: "Frete por cubagem", tipo: "frete", modo: "por_m3", valor: m3, base_calculo: "cubagem", ordem: 20 });
  const coleta = numOuNulo(t["valor_coleta"]);
  if (coleta !== null) out.push({ nome: "Taxa de coleta", tipo: "taxa", modo: "valor_fixo", valor: coleta, base_calculo: "nenhuma", ordem: 50 });
  const entrega = numOuNulo(t["valor_entrega"]);
  if (entrega !== null) out.push({ nome: "Taxa de entrega", tipo: "taxa", modo: "valor_fixo", valor: entrega, base_calculo: "nenhuma", ordem: 60 });
  const min = numOuNulo(t["valor_minimo"]);
  if (min !== null) out.push({ nome: "Frete mínimo", tipo: "minimo", modo: "minimo", valor: min, base_calculo: "nenhuma", ordem: 900 });
  return out;
}

/** Escolhe a tabela mais específica para o contexto (cliente > rota/origem/destino > faixa). */
export function escolherTabela<T extends Record<string, any>>(
  tabelas: T[],
  ctx: ContextoFrete & { peso_taxado?: number | null; cubagem?: number | null },
): T | null {
  const igual = (a?: string | null, b?: string | null) =>
    !a || !b || String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

  const candidatas = tabelas.filter((t) => {
    if (t["ativo"] === false) return false;
    if (t["cliente_id"] && ctx.cliente_id && t["cliente_id"] !== ctx.cliente_id) return false;
    if (t["cliente_id"] && !ctx.cliente_id) return false;
    if (!igual(t["origem"], ctx.origem)) return false;
    if (!igual(t["destino"], ctx.destino)) return false;
    const pt = n0(ctx.peso_taxado ?? ctx.peso);
    const min = numOuNulo(t["faixa_peso_min"]);
    const max = numOuNulo(t["faixa_peso_max"]);
    if (min !== null && pt < min) return false;
    if (max !== null && pt > max) return false;
    const cb = n0(ctx.cubagem);
    const cmin = numOuNulo(t["faixa_cubagem_min"]);
    const cmax = numOuNulo(t["faixa_cubagem_max"]);
    if (cmin !== null && cb < cmin) return false;
    if (cmax !== null && cb > cmax) return false;
    return true;
  });

  candidatas.sort((a, b) => {
    const score = (t: T) =>
      (t["cliente_id"] ? 4 : 0) + (t["origem"] ? 2 : 0) + (t["destino"] ? 2 : 0) + (t["faixa_peso_max"] != null ? 1 : 0);
    return score(b) - score(a);
  });
  return candidatas[0] ?? null;
}
