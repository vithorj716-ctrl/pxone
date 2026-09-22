// ============================================================================
// MOTOR ÚNICO DE CÁLCULO DE FRETE DO GRUPO PX.
// Toda tabela comercial (PXSales) e toda tabela legada (PXLog/TMS) é convertida
// para RegraKernel e avaliada aqui. Não existe outro motor no projeto.
//
// Regras de ouro:
//  - ausência (null) é diferente de zero: regra sem valor NÃO entra no cálculo
//    e gera aviso explicando o motivo (nunca vira R$ 0,00 silencioso);
//  - a fórmula vem da configuração da regra, nunca do nome dela;
//  - frete mínimo é piso comercial, não componente somado.
// ============================================================================

import { arred2, numOuNulo } from "@/pxlog/num";

export type GrupoRegra = "frete" | "adicional" | "taxa" | "servico" | "desconto" | "minimo";

export type ModoRegra =
  | "fixo"
  | "percentual"
  | "por_kg"
  | "por_ton"
  | "por_m3"
  | "por_km"
  | "por_volume"
  | "por_eixo"
  | "por_100kg"
  | "por_hora"
  | "por_diaria"
  | "por_nota"
  | "excedente"
  | "faixa"
  | "minimo";

export type BaseKernel =
  | "nenhuma"
  | "valor_mercadoria"
  | "valor_frete"
  | "subtotal"
  | "peso"
  | "peso_taxado"
  | "cubagem"
  | "volumes"
  | "distancia";

export type FaixaKernel = {
  min: number | null;
  max: number | null;
  modo: ModoRegra;
  valor: number | null;
  piso?: number | null;
  max_inclusive?: boolean;
};

export type RegraKernel = {
  id?: string | null;
  codigo?: string;
  nome: string;
  grupo: GrupoRegra;
  modo: ModoRegra;
  valor: number | null;
  base?: BaseKernel;
  unidade?: string | null;
  faixas?: FaixaKernel[];
  faixa_campo?: BaseKernel | null;
  faixa_min?: number | null;
  faixa_max?: number | null;
  rota_id?: string | null;
  piso?: number | null;
  teto?: number | null;
  peso_inicial?: number | null;
  /** quando informado, a regra só é aplicada se a flag estiver ligada no contexto */
  condicao?: string | null;
  /** frete mínimo: piso sobre o frete ou sobre o total (padrão) */
  aplicar_em?: "frete" | "total";
  ordem?: number | null;
  ativo?: boolean;
  meta?: Record<string, unknown>;
};

export type ContextoKernel = {
  peso?: number | null;
  peso_cubado?: number | null;
  peso_taxado?: number | null;
  cubagem?: number | null;
  volumes?: number | null;
  valor_mercadoria?: number | null;
  distancia_km?: number | null;
  eixos?: number | null;
  horas_espera?: number | null;
  diarias?: number | null;
  rota_id?: string | null;
  flags?: Record<string, boolean>;
};

export type LinhaKernel = {
  regra_id: string | null;
  codigo: string;
  nome: string;
  grupo: GrupoRegra;
  modo: ModoRegra;
  base_calculo: BaseKernel;
  base: number;
  parametro: number | null;
  valor: number;
  detalhe: Record<string, unknown>;
};

export type ResultadoKernel = {
  linhas: LinhaKernel[];
  frete_calculado: number;
  adicionais: number;
  subtotal: number;
  /** piso configurado na tabela (null quando não há regra de mínimo aplicável) */
  frete_minimo: number | null;
  /** quanto foi somado para alcançar o piso */
  ajuste_minimo: number;
  minimo_aplicado: number | null;
  minimo_motivo: string | null;
  frete_aplicado: number;
  total: number;
  avisos: string[];
};

const n0 = (v: unknown) => numOuNulo(v) ?? 0;

export function valorDaBase(
  base: BaseKernel | string | null | undefined,
  ctx: ContextoKernel,
  acum: { frete: number; subtotal: number },
): number {
  switch (base) {
    case "valor_mercadoria":
      return n0(ctx.valor_mercadoria);
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

function limitar(valor: number, piso?: number | null, teto?: number | null) {
  let v = valor;
  const min = numOuNulo(piso);
  const max = numOuNulo(teto);
  if (min !== null && v < min) v = min;
  if (max !== null && v > max) v = max;
  return v;
}

function escolherFaixa(faixas: FaixaKernel[], atual: number): FaixaKernel | undefined {
  return faixas.find((f) => {
    const min = numOuNulo(f.min);
    const max = numOuNulo(f.max);
    const inclusivo = f.max_inclusive !== false;
    if (min !== null && atual < min) return false;
    if (max !== null && (inclusivo ? atual > max : atual >= max)) return false;
    return true;
  });
}

/** Valor bruto de um modo de cobrança. Retorna null quando o modo não é reconhecido. */
function aplicarModo(
  modo: ModoRegra,
  parametro: number,
  base: BaseKernel,
  ctx: ContextoKernel,
  acum: { frete: number; subtotal: number },
  regra: RegraKernel,
): { valor: number; base: number } | null {
  switch (modo) {
    case "fixo":
    case "por_nota":
      return { valor: parametro, base: 1 };
    case "percentual": {
      const b = valorDaBase(base, ctx, acum);
      return { valor: (b * parametro) / 100, base: b };
    }
    case "por_kg": {
      const b = valorDaBase(base === "peso" ? "peso" : "peso_taxado", ctx, acum);
      return { valor: b * parametro, base: b };
    }
    case "por_ton": {
      const b = valorDaBase(base === "peso" ? "peso" : "peso_taxado", ctx, acum);
      return { valor: (b / 1000) * parametro, base: b };
    }
    case "por_m3": {
      const b = n0(ctx.cubagem);
      return { valor: b * parametro, base: b };
    }
    case "por_km": {
      const b = n0(ctx.distancia_km);
      return { valor: b * parametro, base: b };
    }
    case "por_volume": {
      const b = n0(ctx.volumes);
      return { valor: b * parametro, base: b };
    }
    case "por_eixo": {
      const b = Math.max(1, n0(ctx.eixos));
      return { valor: b * parametro, base: b };
    }
    case "por_100kg": {
      const pt = valorDaBase("peso_taxado", ctx, acum);
      const b = Math.ceil(pt / 100);
      return { valor: b * parametro, base: b };
    }
    case "por_hora": {
      const b = n0(ctx.horas_espera);
      return { valor: b * parametro, base: b };
    }
    case "por_diaria": {
      const b = n0(ctx.diarias);
      return { valor: b * parametro, base: b };
    }
    case "excedente": {
      const pt = valorDaBase("peso_taxado", ctx, acum);
      const inicial = numOuNulo(regra.peso_inicial) ?? 0;
      const b = Math.max(0, pt - inicial);
      return { valor: b * parametro, base: b };
    }
    default:
      return null;
  }
}

function pisoDaRegra(regra: RegraKernel, ctx: ContextoKernel, acum: { frete: number; subtotal: number }): number | null {
  if (regra.faixas?.length) {
    const campo = (regra.faixa_campo ?? "peso_taxado") as BaseKernel;
    const atual = valorDaBase(campo, ctx, acum);
    const f = escolherFaixa(regra.faixas, atual);
    if (!f) return null;
    const v = numOuNulo(f.valor);
    if (v === null) return null;
    const r = aplicarModo(f.modo ?? "fixo", v, (regra.base ?? "nenhuma") as BaseKernel, ctx, acum, regra);
    return r ? arred2(r.valor) : null;
  }
  const v = numOuNulo(regra.valor);
  if (v === null) return null;
  const base = (regra.base ?? "nenhuma") as BaseKernel;
  if (base === "nenhuma") return arred2(v);
  const r = aplicarModo(regra.modo === "minimo" ? "percentual" : regra.modo, v, base, ctx, acum, regra);
  // mínimo com base = multiplicação direta (ex.: R$ 1,50/kg)
  const b = valorDaBase(base, ctx, acum);
  return arred2(regra.modo === "minimo" ? v * b : (r?.valor ?? v));
}

/** Avaliação de uma regra isolada. Retorna null quando não se aplica ao contexto. */
export function avaliarRegra(
  regra: RegraKernel,
  ctx: ContextoKernel,
  acum: { frete: number; subtotal: number },
  avisos: string[],
): LinhaKernel | null {
  if (regra.ativo === false) return null;
  if (regra.condicao && !ctx.flags?.[regra.condicao]) return null;
  if (regra.rota_id && ctx.rota_id && regra.rota_id !== ctx.rota_id) return null;

  // faixa de aplicação (a regra só vale dentro de um intervalo)
  if (regra.faixa_campo && (regra.faixa_min != null || regra.faixa_max != null)) {
    const atual = valorDaBase(regra.faixa_campo, ctx, acum);
    const min = numOuNulo(regra.faixa_min);
    const max = numOuNulo(regra.faixa_max);
    if (min !== null && atual < min) return null;
    if (max !== null && atual > max) return null;
  }

  const base = (regra.base ?? "nenhuma") as BaseKernel;
  const codigo = regra.codigo ?? regra.nome;

  if (regra.modo === "faixa") {
    const faixas = regra.faixas ?? [];
    const campo = (regra.faixa_campo ?? (base !== "nenhuma" ? base : "peso_taxado")) as BaseKernel;
    const atual = valorDaBase(campo, ctx, acum);
    const f = escolherFaixa(faixas, atual);
    if (!f) {
      avisos.push(`"${regra.nome}": nenhuma faixa cadastrada cobre ${atual} (${campo}).`);
      return null;
    }
    const v = numOuNulo(f.valor);
    if (v === null) {
      avisos.push(`"${regra.nome}": faixa selecionada está sem valor configurado.`);
      return null;
    }
    const r = aplicarModo(f.modo ?? "fixo", v, base, ctx, acum, regra);
    if (!r) {
      avisos.push(`"${regra.nome}": modo de cobrança "${f.modo}" desconhecido na faixa.`);
      return null;
    }
    let valor = limitar(r.valor, f.piso ?? regra.piso, regra.teto);
    if (regra.grupo === "desconto") valor = -Math.abs(valor);
    return {
      regra_id: regra.id ?? null,
      codigo,
      nome: regra.nome,
      grupo: regra.grupo,
      modo: "faixa",
      base_calculo: campo,
      base: arred2(atual),
      parametro: v,
      valor: arred2(valor),
      detalhe: { faixa: `${f.min ?? 0}–${f.max ?? "∞"}`, modo_faixa: f.modo, campo },
    };
  }

  const parametro = numOuNulo(regra.valor);
  if (parametro === null && !regra.faixas?.length) {
    avisos.push(`"${regra.nome}": sem valor configurado — não entrou no cálculo.`);
    return null;
  }

  if (regra.modo === "percentual" && base === "nenhuma") {
    avisos.push(`"${regra.nome}": percentual sem base de cálculo definida — ignorado.`);
    return null;
  }

  const r = aplicarModo(regra.modo, parametro!, base, ctx, acum, regra);
  if (!r) {
    avisos.push(`"${regra.nome}": modo de cobrança "${regra.modo}" desconhecido.`);
    return null;
  }

  let valor = limitar(r.valor, regra.piso, regra.teto);
  if (regra.grupo === "desconto") valor = -Math.abs(valor);

  return {
    regra_id: regra.id ?? null,
    codigo,
    nome: regra.nome,
    grupo: regra.grupo,
    modo: regra.modo,
    base_calculo: base,
    base: arred2(r.base),
    parametro,
    valor: arred2(valor),
    detalhe: { unidade: regra.unidade ?? null, ...(regra.meta ?? {}) },
  };
}

/** Executa a tabela inteira. Este é o único ponto de cálculo do sistema. */
export function calcularKernel(regras: RegraKernel[], ctx: ContextoKernel): ResultadoKernel {
  const avisos: string[] = [];
  const ordenadas = [...(regras ?? [])]
    .filter((x) => x && x.ativo !== false)
    .sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100));

  const linhas: LinhaKernel[] = [];
  const acum = { frete: 0, subtotal: 0 };
  let minimo: number | null = null;
  let minimoNome: string | null = null;
  let minimoEm: "frete" | "total" = "total";

  for (const regra of ordenadas) {
    if (regra.grupo === "minimo" || regra.modo === "minimo") {
      if (regra.condicao && !ctx.flags?.[regra.condicao]) continue;
      if (regra.rota_id && ctx.rota_id && regra.rota_id !== ctx.rota_id) continue;
      const piso = pisoDaRegra(regra, ctx, acum);
      if (piso === null) {
        avisos.push(`"${regra.nome}": frete mínimo sem valor configurado — piso não aplicado.`);
        continue;
      }
      if (minimo === null || piso > minimo) {
        minimo = piso;
        minimoNome = regra.nome;
        minimoEm = regra.aplicar_em ?? "total";
      }
      continue;
    }
    const linha = avaliarRegra(regra, ctx, acum, avisos);
    if (!linha) continue;
    linhas.push(linha);
    if (linha.grupo === "frete") acum.frete = arred2(acum.frete + linha.valor);
    acum.subtotal = arred2(acum.subtotal + linha.valor);
  }

  const freteCalculado = arred2(acum.frete);
  const subtotal = arred2(acum.subtotal);

  let ajuste = 0;
  let minimoAplicado: number | null = null;
  let motivo: string | null = null;
  let freteAplicado = freteCalculado;
  let total = subtotal;

  if (minimo !== null) {
    const comparado = minimoEm === "frete" ? freteCalculado : subtotal;
    if (comparado < minimo) {
      ajuste = arred2(minimo - comparado);
      minimoAplicado = minimo;
      total = arred2(total + ajuste);
      if (minimoEm === "frete") freteAplicado = arred2(freteCalculado + ajuste);
      motivo = `${minimoEm === "frete" ? "Frete" : "Total"} calculado (R$ ${comparado.toFixed(2)}) menor que o mínimo da tabela (R$ ${minimo.toFixed(2)})${minimoNome ? ` — regra "${minimoNome}"` : ""}.`;
    } else {
      motivo = `${minimoEm === "frete" ? "Frete" : "Total"} calculado (R$ ${comparado.toFixed(2)}) já supera o mínimo de R$ ${minimo.toFixed(2)}.`;
    }
  }

  return {
    linhas,
    frete_calculado: freteCalculado,
    adicionais: arred2(subtotal - freteCalculado),
    subtotal,
    frete_minimo: minimo,
    ajuste_minimo: ajuste,
    minimo_aplicado: minimoAplicado,
    minimo_motivo: motivo,
    frete_aplicado: freteAplicado,
    total: arred2(total),
    avisos,
  };
}

/* ============================== CUBAGEM REAL ============================== */

export type VolumeDimensao = {
  qtd?: number | null;
  comprimento?: number | null;
  largura?: number | null;
  altura?: number | null;
  /** unidade das dimensões informadas (padrão: metros) */
  unidade?: "m" | "cm" | "mm";
};

const emMetros = (v: number, u: VolumeDimensao["unidade"]) => (u === "cm" ? v / 100 : u === "mm" ? v / 1000 : v);

/** m³ total de uma lista de grupos de volumes (qtd × C × L × A). */
export function cubagemDeVolumes(vols: VolumeDimensao[] | null | undefined): { cubagem: number; volumes: number } {
  let cubagem = 0;
  let volumes = 0;
  for (const v of vols ?? []) {
    const qtd = Math.max(0, numOuNulo(v.qtd) ?? 0);
    const c = emMetros(numOuNulo(v.comprimento) ?? 0, v.unidade);
    const l = emMetros(numOuNulo(v.largura) ?? 0, v.unidade);
    const a = emMetros(numOuNulo(v.altura) ?? 0, v.unidade);
    if (qtd <= 0) continue;
    volumes += qtd;
    cubagem += qtd * c * l * a;
  }
  return { cubagem: Math.round(cubagem * 1000) / 1000, volumes };
}

/** Peso tarifável a partir do fator de cubagem e da regra da tabela. */
export function pesoTaxavel(
  peso: number,
  cubagem: number,
  fator: number,
  regra: "maior" | "real" | "cubado" = "maior",
): { peso_cubado: number; peso_taxado: number } {
  const pesoCubado = arred2(cubagem * fator);
  const taxado = regra === "real" ? arred2(peso) : regra === "cubado" ? pesoCubado : arred2(Math.max(peso, pesoCubado));
  return { peso_cubado: pesoCubado, peso_taxado: taxado };
}
