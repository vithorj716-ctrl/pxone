// PXSales — TABELA COMERCIAL: fonte única de verdade das regras de preço.
// A avaliação NUNCA acontece aqui: este módulo apenas traduz os componentes
// configurados na tabela para o motor único (src/pxsales/calc-kernel.ts).
// O PXLog/TMS consome a tabela publicada; não existe segunda tabela comercial.

import {
  calcularKernel,
  cubagemDeVolumes,
  pesoTaxavel,
  type BaseKernel,
  type ModoRegra,
  type RegraKernel,
  type VolumeDimensao,
} from "./calc-kernel";
import { numOuNulo } from "@/pxlog/num";

export type ComponenteTipo =
  | "frete_base"
  | "frete_minimo"
  | "faixa_peso"
  | "excedente_peso"
  | "cubagem"
  | "pedagio"
  | "gris"
  | "advalorem"
  | "taxa_coleta"
  | "taxa_entrega"
  | "taxa_reentrega"
  | "taxa_devolucao"
  | "taxa_dificuldade"
  | "taxa_area_risco"
  | "taxa_espera"
  | "taxa_estadia"
  | "taxa_personalizada";

export const COMPONENTES_CATALOGO: {
  tipo: ComponenteTipo;
  codigo: string;
  nome: string;
  grupo: string;
  descricao: string;
}[] = [
  { tipo: "cubagem", codigo: "cubagem", nome: "Cubagem", grupo: "Frete", descricao: "Fator de cubagem e regra de peso taxado." },
  { tipo: "frete_base", codigo: "frete_base", nome: "Frete base", grupo: "Frete", descricao: "Valor principal do transporte." },
  { tipo: "frete_minimo", codigo: "frete_minimo", nome: "Frete mínimo", grupo: "Frete", descricao: "Piso comercial: fixo, por kg, por faixa ou por rota." },
  { tipo: "faixa_peso", codigo: "faixa_peso", nome: "Faixas de peso", grupo: "Frete", descricao: "Valor por faixa de peso taxado." },
  { tipo: "excedente_peso", codigo: "excedente_peso", nome: "Excedente de peso", grupo: "Frete", descricao: "Cobrança acima de um peso inicial." },
  { tipo: "pedagio", codigo: "pedagio", nome: "Pedágio", grupo: "Adicionais", descricao: "Fixo, por eixo, por 100 kg ou percentual." },
  { tipo: "gris", codigo: "gris", nome: "GRIS", grupo: "Adicionais", descricao: "Gerenciamento de risco." },
  { tipo: "advalorem", codigo: "advalorem", nome: "Ad Valorem", grupo: "Adicionais", descricao: "Percentual sobre o valor da mercadoria." },
  { tipo: "taxa_coleta", codigo: "taxa_coleta", nome: "Taxa de coleta", grupo: "Taxas", descricao: "Cobrança da coleta." },
  { tipo: "taxa_entrega", codigo: "taxa_entrega", nome: "Taxa de entrega", grupo: "Taxas", descricao: "Cobrança da entrega." },
  { tipo: "taxa_reentrega", codigo: "taxa_reentrega", nome: "Reentrega", grupo: "Taxas", descricao: "Nova tentativa de entrega." },
  { tipo: "taxa_devolucao", codigo: "taxa_devolucao", nome: "Devolução", grupo: "Taxas", descricao: "Retorno da mercadoria." },
  { tipo: "taxa_dificuldade", codigo: "taxa_dificuldade", nome: "Dificuldade de entrega", grupo: "Taxas", descricao: "Local de difícil acesso." },
  { tipo: "taxa_area_risco", codigo: "taxa_area_risco", nome: "Área de risco", grupo: "Taxas", descricao: "Regiões com restrição." },
  { tipo: "taxa_espera", codigo: "taxa_espera", nome: "Espera", grupo: "Taxas", descricao: "Tempo parado no cliente." },
  { tipo: "taxa_estadia", codigo: "taxa_estadia", nome: "Estadia", grupo: "Taxas", descricao: "Permanência do veículo." },
  { tipo: "taxa_personalizada", codigo: "taxa_personalizada", nome: "Componente personalizado", grupo: "Taxas", descricao: "Regra específica do cliente." },
];

export const ORDEM_PADRAO: string[] = [
  "cubagem",
  "frete_base",
  "faixa_peso",
  "excedente_peso",
  "pedagio",
  "gris",
  "advalorem",
  "taxa_coleta",
  "taxa_entrega",
  "taxa_reentrega",
  "taxa_devolucao",
  "taxa_dificuldade",
  "taxa_area_risco",
  "taxa_espera",
  "taxa_estadia",
  "taxa_personalizada",
  "frete_minimo",
];

export type Faixa = {
  id?: string;
  peso_min: number;
  peso_max: number;
  tipo_valor: "fixo" | "por_kg" | "percentual";
  valor: number;
  valor_minimo: number;
};

export type Componente = {
  id?: string;
  codigo: string;
  tipo: ComponenteTipo | string;
  nome: string;
  ativo: boolean;
  ordem: number;
  config: Record<string, any>;
  faixas?: Faixa[];
};

export type VersaoCalculo = {
  id?: string;
  versao?: number;
  ordem_calculo?: string[] | null;
  componentes: Componente[];
};

export type EntradaCotacao = {
  peso: number;
  /** cubagem informada (LEGACY). Prefira volumes_dim: o sistema calcula o m³. */
  cubagem?: number;
  /** dimensões reais dos volumes — origem correta da cubagem */
  volumes_dim?: VolumeDimensao[];
  qtd_volumes: number;
  valor_mercadoria: number;
  eixos?: number;
  distancia_km?: number;
  rota_id?: string | null;
  horas_espera?: number;
  diarias?: number;
  desconto_percentual?: number;
  reentrega?: boolean;
  devolucao?: boolean;
  area_risco?: boolean;
  dificuldade?: boolean;
};

export type LinhaCalculo = {
  codigo: string;
  nome: string;
  base: number;
  valor: number;
  detalhe: Record<string, any>;
};

export type ResultadoCalculo = {
  cubagem: number;
  peso_cubado: number;
  peso_taxado: number;
  fator_cubagem: number;
  linhas: LinhaCalculo[];
  frete_calculado: number;
  frete_minimo: number | null;
  frete_aplicado: number;
  minimo_aplicado: number | null;
  minimo_motivo: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  avisos: string[];
};

const num = (v: unknown, d = 0) => numOuNulo(v) ?? d;
const opt = (v: unknown) => numOuNulo(v);
const r2 = (n: number) => Math.round(n * 100) / 100;

export const FATOR_CUBAGEM_PADRAO = 300;

/** Valida faixas: sem sobreposição e sem intervalo inválido. */
export function validarFaixas(faixas: Faixa[]): string[] {
  const erros: string[] = [];
  const ordenadas = [...faixas].sort((a, b) => num(a.peso_min) - num(b.peso_min));
  ordenadas.forEach((f, idx) => {
    if (num(f.peso_max) <= num(f.peso_min)) erros.push(`Faixa ${idx + 1}: peso final deve ser maior que o inicial.`);
    const ant = ordenadas[idx - 1];
    if (ant && num(f.peso_min) < num(ant.peso_max)) erros.push(`Faixa ${idx + 1}: sobrepõe a faixa anterior.`);
  });
  return erros;
}

const BASE_CFG: Record<string, BaseKernel> = {
  mercadoria: "valor_mercadoria",
  valor_mercadoria: "valor_mercadoria",
  nota: "valor_mercadoria",
  frete: "valor_frete",
  valor_frete: "valor_frete",
  subtotal: "subtotal",
  peso: "peso_taxado",
  peso_taxado: "peso_taxado",
};

const baseDe = (cfg: Record<string, any>, padrao: BaseKernel = "valor_mercadoria"): BaseKernel =>
  BASE_CFG[String(cfg?.base ?? "")] ?? padrao;

const MODO_CFG: Record<string, ModoRegra> = {
  fixo: "fixo",
  valor_fixo: "fixo",
  percentual: "percentual",
  por_kg: "por_kg",
  por_ton: "por_ton",
  por_tonelada: "por_ton",
  por_m3: "por_m3",
  por_km: "por_km",
  por_volume: "por_volume",
  por_nota: "fixo",
  por_eixo: "por_eixo",
  por_100kg: "por_100kg",
  por_hora: "por_hora",
  por_diaria: "por_diaria",
};

/** Traduz um componente da tabela em regras do motor único. */
function regrasDoComponente(
  c: Componente,
  ctxPeso: { peso_taxado: number; cubagem: number },
  ordem: number,
  avisos: string[],
): RegraKernel[] {
  const cfg = c.config ?? {};
  const comum = {
    id: c.id ?? null,
    codigo: c.codigo,
    nome: c.nome,
    ordem,
    ativo: c.ativo !== false,
    piso: opt(cfg.minimo),
    teto: opt(cfg.maximo),
    rota_id: (cfg.rota_id as string | undefined) ?? null,
  };

  switch (c.tipo) {
    case "cubagem":
      return [];

    case "frete_base": {
      const modo = String(cfg.modo ?? "fixo");
      if (modo === "maior") {
        const porKg = (opt(cfg.valor) ?? 0) * ctxPeso.peso_taxado;
        const porM3 = (opt(cfg.valor_m3) ?? 0) * ctxPeso.cubagem;
        const escolhido = Math.max(porKg, porM3);
        return [
          {
            ...comum,
            grupo: "frete",
            modo: "fixo",
            valor: r2(escolhido),
            base: "nenhuma",
            piso: opt(cfg.valor_minimo) ?? comum.piso,
            meta: { modo: "maior", por_kg: r2(porKg), por_m3: r2(porM3) },
          },
        ];
      }
      return [
        {
          ...comum,
          grupo: "frete",
          modo: MODO_CFG[modo] ?? "fixo",
          valor: opt(cfg.valor),
          base: modo === "percentual" ? baseDe(cfg) : "peso_taxado",
          piso: opt(cfg.valor_minimo) ?? comum.piso,
          meta: { modo },
        },
      ];
    }

    case "frete_minimo": {
      const modo = String(cfg.modo ?? "fixo");
      const faixas = (c.faixas ?? []).map((f) => ({
        min: num(f.peso_min),
        max: num(f.peso_max),
        modo: (f.tipo_valor === "por_kg" ? "por_kg" : "fixo") as ModoRegra,
        valor: opt(f.valor),
        max_inclusive: false,
      }));
      return [
        {
          ...comum,
          grupo: "minimo",
          modo: "minimo",
          valor: opt(cfg.valor),
          base: modo === "por_kg" ? "peso_taxado" : "nenhuma",
          faixas: modo === "faixa" ? faixas : [],
          faixa_campo: "peso_taxado",
          aplicar_em: cfg.aplicar_em === "total" ? "total" : "frete",
          meta: { modo },
        },
      ];
    }

    case "faixa_peso": {
      const faixas = (c.faixas ?? []).slice().sort((a, b) => num(a.peso_min) - num(b.peso_min));
      if (!faixas.length) avisos.push(`"${c.nome}": nenhuma faixa cadastrada.`);
      return [
        {
          ...comum,
          grupo: "frete",
          modo: "faixa",
          valor: null,
          base: "valor_mercadoria",
          faixa_campo: "peso_taxado",
          faixas: faixas.map((f) => ({
            min: num(f.peso_min),
            max: num(f.peso_max),
            modo: (f.tipo_valor === "por_kg" ? "por_kg" : f.tipo_valor === "percentual" ? "percentual" : "fixo") as ModoRegra,
            valor: opt(f.valor),
            piso: opt(f.valor_minimo),
            max_inclusive: false,
          })),
        },
      ];
    }

    case "excedente_peso": {
      const modo = String(cfg.modo ?? "por_kg");
      return [
        {
          ...comum,
          grupo: "frete",
          modo: modo === "fixo" ? "fixo" : modo === "percentual" ? "percentual" : "excedente",
          valor: opt(cfg.valor),
          base: modo === "percentual" ? "valor_frete" : "peso_taxado",
          peso_inicial: opt(cfg.peso_inicial) ?? 0,
          faixa_campo: "peso_taxado",
          faixa_min: opt(cfg.peso_inicial),
          meta: { modo, peso_inicial: num(cfg.peso_inicial) },
        },
      ];
    }

    case "pedagio": {
      const modo = String(cfg.modo ?? "fixo");
      return [
        {
          ...comum,
          grupo: "adicional",
          modo: MODO_CFG[modo] ?? "fixo",
          valor: opt(cfg.valor),
          base: modo === "percentual" ? baseDe(cfg, "valor_frete") : "nenhuma",
          meta: { modo },
        },
      ];
    }

    case "gris":
    case "advalorem":
      return [
        {
          ...comum,
          grupo: "adicional",
          modo: "percentual",
          valor: opt(cfg.percentual ?? cfg.valor),
          base: baseDe(cfg),
          meta: { percentual: opt(cfg.percentual ?? cfg.valor) },
        },
      ];

    case "taxa_espera":
      return [{ ...comum, grupo: "taxa", modo: "por_hora", valor: opt(cfg.valor), base: "nenhuma" }];

    case "taxa_estadia":
      return [{ ...comum, grupo: "taxa", modo: "por_diaria", valor: opt(cfg.valor), base: "nenhuma" }];

    default: {
      const modo = String(cfg.modo ?? "fixo");
      const condicao =
        c.tipo === "taxa_reentrega" ? "reentrega"
        : c.tipo === "taxa_devolucao" ? "devolucao"
        : c.tipo === "taxa_area_risco" ? "area_risco"
        : c.tipo === "taxa_dificuldade" ? "dificuldade"
        : null;
      return [
        {
          ...comum,
          grupo: c.tipo === "taxa_personalizada" && cfg.grupo === "desconto" ? "desconto" : "taxa",
          modo: MODO_CFG[modo] ?? "fixo",
          valor: opt(cfg.valor),
          base: modo === "percentual" ? baseDe(cfg) : "nenhuma",
          condicao,
          meta: { modo },
        },
      ];
    }
  }
}

/** Calcula uma versão da tabela. Delegado integralmente ao motor único. */
export function calcularTabela(versao: VersaoCalculo, entrada: EntradaCotacao): ResultadoCalculo {
  const avisos: string[] = [];
  const ativos = (versao.componentes ?? []).filter((c) => c.ativo);
  const mapa = new Map(ativos.map((c) => [c.codigo, c]));

  const ordem = (versao.ordem_calculo?.length ? versao.ordem_calculo : ORDEM_PADRAO).slice();
  for (const c of ativos) if (!ordem.includes(c.codigo)) ordem.push(c.codigo);

  // 1. cubagem real: dimensões dos volumes têm prioridade sobre m³ digitado
  const dims = entrada.volumes_dim?.length ? cubagemDeVolumes(entrada.volumes_dim) : null;
  const cubagem = dims ? dims.cubagem : num(entrada.cubagem);
  const volumes = Math.max(1, dims?.volumes || num(entrada.qtd_volumes, 1));
  if (!dims && !entrada.cubagem) avisos.push("Cubagem não informada: informe as dimensões dos volumes para o peso cubado.");

  const compCub = mapa.get("cubagem");
  const fator = compCub ? num(compCub.config?.fator, FATOR_CUBAGEM_PADRAO) : FATOR_CUBAGEM_PADRAO;
  const regraPeso = String(compCub?.config?.regra ?? "maior") as "maior" | "real" | "cubado";
  const { peso_cubado, peso_taxado } = pesoTaxavel(num(entrada.peso), cubagem, fator, regraPeso);

  // 2. componentes -> regras do motor único, na ordem configurada
  const regras: RegraKernel[] = [];
  ordem.forEach((codigo, idx) => {
    const c = mapa.get(codigo);
    if (!c) return;
    regras.push(...regrasDoComponente(c, { peso_taxado, cubagem }, (idx + 1) * 10, avisos));
  });

  const res = calcularKernel(regras, {
    peso: num(entrada.peso),
    peso_cubado,
    peso_taxado,
    cubagem,
    volumes,
    valor_mercadoria: num(entrada.valor_mercadoria),
    distancia_km: num(entrada.distancia_km),
    eixos: num(entrada.eixos),
    horas_espera: num(entrada.horas_espera),
    diarias: num(entrada.diarias),
    rota_id: entrada.rota_id ?? null,
    flags: {
      reentrega: !!entrada.reentrega,
      devolucao: !!entrada.devolucao,
      area_risco: !!entrada.area_risco,
      dificuldade: !!entrada.dificuldade,
    },
  });

  const desconto = r2((res.total * num(entrada.desconto_percentual)) / 100);
  const total = r2(Math.max(0, res.total - desconto));

  const linhas: LinhaCalculo[] = res.linhas.map((l) => ({
    codigo: l.codigo,
    nome: l.nome,
    base: l.base,
    valor: l.valor,
    detalhe: { grupo: l.grupo, modo: l.modo, base_calculo: l.base_calculo, parametro: l.parametro, ...l.detalhe },
  }));
  if (res.ajuste_minimo > 0) {
    linhas.push({
      codigo: "ajuste_frete_minimo",
      nome: "Ajuste para o frete mínimo",
      base: res.frete_minimo ?? 0,
      valor: res.ajuste_minimo,
      detalhe: { grupo: "minimo", motivo: res.minimo_motivo },
    });
  }

  return {
    cubagem,
    peso_cubado,
    peso_taxado,
    fator_cubagem: fator,
    linhas,
    frete_calculado: res.frete_calculado,
    frete_minimo: res.frete_minimo,
    frete_aplicado: res.frete_aplicado,
    minimo_aplicado: res.minimo_aplicado,
    minimo_motivo: res.minimo_motivo,
    subtotal: res.total,
    desconto,
    total,
    avisos: [...avisos, ...res.avisos],
  };
}
