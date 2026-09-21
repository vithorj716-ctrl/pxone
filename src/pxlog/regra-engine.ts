// Motor ÚNICO de cálculo das tabelas comerciais de frete do PXLog/PXSales.
// A fórmula vem SEMPRE da configuração estruturada da regra — nunca do nome dela.

import { arred2, numOuNulo } from "./num";

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

function valorDaBase(
  base: string,
  ctx: ContextoFrete,
  acum: { frete: number; subtotal: number },
): number {
  switch (base) {
    case "valor_nota":
      return n0(ctx.valor_nota);
    case "valor_frete":
      return acum.frete;
    case "subtotal":
      return acum.subtotal;
    case "peso":
      return n0(ctx.peso);
    case "peso_taxado":
      return n0(ctx.peso_taxado ?? ctx.peso);
    case "cubagem":
      return n0(ctx.cubagem);
    case "volumes":
      return n0(ctx.volumes);
    case "distancia":
      return n0(ctx.distancia_km);
    default:
      return 0;
  }
}

function campoFaixa(campo: string | null | undefined, ctx: ContextoFrete): number | null {
  if (!campo) return null;
  return valorDaBase(campo, ctx, { frete: 0, subtotal: 0 });
}

function aplicarLimites(valor: number, regra: RegraComercial): number {
  let v = valor;
  const min = numOuNulo(regra.valor_minimo);
  const max = numOuNulo(regra.valor_maximo);
  if (min !== null && v < min) v = min;
  if (max !== null && v > max) v = max;
  return v;
}

/** Calcula uma regra isolada. Retorna null quando a regra não se aplica ao contexto. */
export function calcularRegra(
  regra: RegraComercial,
  ctx: ContextoFrete,
  acum: { frete: number; subtotal: number },
  avisos: string[],
): LinhaCalculo | null {
  if (regra.ativo === false) return null;
  if (regra.rota_id && ctx.rota_id && regra.rota_id !== ctx.rota_id) return null;

  // Filtro de faixa de aplicação (quando a regra só vale dentro de um intervalo).
  if (regra.faixa_campo) {
    const atual = campoFaixa(regra.faixa_campo, ctx) ?? 0;
    const min = numOuNulo(regra.faixa_min);
    const max = numOuNulo(regra.faixa_max);
    if (min !== null && atual < min) return null;
    if (max !== null && atual > max) return null;
  }

  const modo = String(regra.modo);
  const parametro = numOuNulo(regra.valor);

  if (modo === "faixa") {
    const faixas = (regra.config?.["faixas"] as FaixaRegra[] | undefined) ?? [];
    const campo = regra.faixa_campo || regra.base_calculo || "peso_taxado";
    const atual = valorDaBase(campo, ctx, acum);
    const faixa = faixas.find((f) => {
      const min = numOuNulo(f.min);
      const max = numOuNulo(f.max);
      return (min === null || atual >= min) && (max === null || atual <= max);
    });
    if (!faixa) {
      avisos.push(`"${regra.nome}": nenhuma faixa cobre ${atual}.`);
      return null;
    }
    const sub = calcularRegra(
      { ...regra, modo: faixa.modo, valor: faixa.valor, faixa_campo: null, config: null },
      ctx,
      acum,
      avisos,
    );
    return sub ? { ...sub, modo: "faixa" } : null;
  }

  if (modo === "minimo") {
    if (parametro === null) return null;
    return {
      regra_id: regra.id ?? null,
      nome: regra.nome,
      tipo: "minimo",
      modo,
      base_calculo: "nenhuma",
      base: 0,
      parametro,
      valor: 0, // o piso é aplicado ao final, não soma como componente
    };
  }

  if (parametro === null) return null; // não configurado (≠ zero)

  let base = 0;
  let valor = 0;

  switch (modo) {
    case "valor_fixo":
      base = 1;
      valor = parametro; // valor fixo NUNCA ganha base automática
      break;
    case "percentual": {
      const b = String(regra.base_calculo ?? "nenhuma");
      if (b === "nenhuma") {
        avisos.push(`"${regra.nome}": percentual sem base de cálculo definida — ignorado.`);
        return null;
      }
      base = valorDaBase(b, ctx, acum);
      valor = (base * parametro) / 100;
      break;
    }
    case "por_kg":
      base = valorDaBase(regra.base_calculo === "peso" ? "peso" : "peso_taxado", ctx, acum);
      valor = base * parametro;
      break;
    case "por_m3":
      base = n0(ctx.cubagem);
      valor = base * parametro;
      break;
    case "por_km":
      base = n0(ctx.distancia_km);
      valor = base * parametro;
      break;
    case "por_volume":
      base = n0(ctx.volumes);
      valor = base * parametro;
      break;
    default:
      avisos.push(`"${regra.nome}": modo de cobrança "${modo}" desconhecido.`);
      return null;
  }

  valor = aplicarLimites(valor, regra);
  if (String(regra.tipo) === "desconto") valor = -Math.abs(valor);

  return {
    regra_id: regra.id ?? null,
    nome: regra.nome,
    tipo: String(regra.tipo),
    modo,
    base_calculo: String(regra.base_calculo ?? "nenhuma"),
    base: arred2(base),
    parametro,
    valor: arred2(valor),
  };
}

/** Motor único: executa exatamente a configuração das regras da tabela. */
export function calcularTabelaFrete(regras: RegraComercial[], ctx: ContextoFrete): ResultadoFrete {
  const avisos: string[] = [];
  const ordenadas = [...(regras ?? [])].sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100));

  const linhas: LinhaCalculo[] = [];
  const acum = { frete: 0, subtotal: 0 };
  let minimo: number | null = null;

  for (const regra of ordenadas) {
    const linha = calcularRegra(regra, ctx, acum, avisos);
    if (!linha) continue;
    if (linha.modo === "minimo") {
      const p = linha.parametro ?? 0;
      minimo = minimo === null ? p : Math.max(minimo, p);
      continue;
    }
    linhas.push(linha);
    if (linha.tipo === "frete") acum.frete = arred2(acum.frete + linha.valor);
    acum.subtotal = arred2(acum.subtotal + linha.valor);
  }

  const subtotal = arred2(acum.subtotal);
  let total = subtotal;
  let minimoAplicado: number | null = null;
  if (minimo !== null && total < minimo) {
    total = minimo;
    minimoAplicado = minimo;
  }

  return {
    linhas,
    frete_base: arred2(acum.frete),
    adicionais: arred2(subtotal - acum.frete),
    subtotal,
    minimo_aplicado: minimoAplicado,
    total: arred2(total),
    avisos,
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
