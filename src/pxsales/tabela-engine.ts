// PXSales — motor de cálculo das TABELAS COMERCIAIS.
// Função pura, usada no servidor (valor oficial gravado) e na prévia da tela.
// Não duplica o TMS: o PXLog continua sendo a fonte operacional; aqui fica a camada comercial.

export type ComponenteTipo =
  | "frete_base"
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
  { tipo: "frete_base", codigo: "frete_base", nome: "Frete base", grupo: "Frete", descricao: "Valor principal do transporte." },
  { tipo: "faixa_peso", codigo: "faixa_peso", nome: "Faixas de peso", grupo: "Frete", descricao: "Valor por faixa de peso taxado." },
  { tipo: "excedente_peso", codigo: "excedente_peso", nome: "Excedente de peso", grupo: "Frete", descricao: "Cobrança acima de um peso inicial." },
  { tipo: "cubagem", codigo: "cubagem", nome: "Cubagem", grupo: "Frete", descricao: "Fator de cubagem e regra de peso taxado." },
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
  cubagem: number;
  qtd_volumes: number;
  valor_mercadoria: number;
  eixos?: number;
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
  peso_cubado: number;
  peso_taxado: number;
  linhas: LinhaCalculo[];
  subtotal: number;
  desconto: number;
  total: number;
  avisos: string[];
};

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : d;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const limitar = (v: number, min?: unknown, max?: unknown) => {
  let x = v;
  const mn = num(min);
  const mx = num(max);
  if (mn > 0 && x < mn) x = mn;
  if (mx > 0 && x > mx) x = mx;
  return x;
};

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

function baseDe(config: Record<string, any>, ctx: { mercadoria: number; frete: number; subtotal: number }) {
  switch (String(config?.base ?? "mercadoria")) {
    case "frete":
      return ctx.frete;
    case "subtotal":
      return ctx.subtotal;
    default:
      return ctx.mercadoria;
  }
}

function valorGenerico(
  config: Record<string, any>,
  ctx: { mercadoria: number; frete: number; subtotal: number; peso: number; volumes: number },
): { valor: number; base: number; detalhe: Record<string, any> } {
  const modo = String(config?.modo ?? "fixo");
  const v = num(config?.valor);
  let base = 0;
  let valor = 0;
  if (modo === "percentual") {
    base = baseDe(config, ctx);
    valor = (base * v) / 100;
  } else if (modo === "por_volume") {
    base = ctx.volumes;
    valor = base * v;
  } else if (modo === "por_kg") {
    base = ctx.peso;
    valor = base * v;
  } else {
    base = 1;
    valor = v;
  }
  valor = limitar(valor, config?.minimo, config?.maximo);
  return { valor: r2(valor), base: r2(base), detalhe: { modo, parametro: v } };
}

export function calcularTabela(versao: VersaoCalculo, entrada: EntradaCotacao): ResultadoCalculo {
  const avisos: string[] = [];
  const ativos = (versao.componentes ?? []).filter((c) => c.ativo);
  const mapa = new Map(ativos.map((c) => [c.codigo, c]));
  const ordem = (versao.ordem_calculo?.length ? versao.ordem_calculo : ORDEM_PADRAO).slice();
  for (const c of ativos) if (!ordem.includes(c.codigo)) ordem.push(c.codigo);

  const peso = num(entrada.peso);
  const cubagem = num(entrada.cubagem);
  const volumes = Math.max(1, num(entrada.qtd_volumes, 1));
  const mercadoria = num(entrada.valor_mercadoria);

  // 1. peso real x cubado
  const compCub = mapa.get("cubagem");
  const fator = compCub ? num(compCub.config?.fator, FATOR_CUBAGEM_PADRAO) : FATOR_CUBAGEM_PADRAO;
  const pesoCubado = r2(cubagem * fator);
  const regra = String(compCub?.config?.regra ?? "maior");
  const pesoTaxado =
    regra === "real" ? r2(peso) : regra === "cubado" ? r2(pesoCubado) : r2(Math.max(peso, pesoCubado));

  const linhas: LinhaCalculo[] = [];
  let frete = 0; // acumulado de frete (base + faixa + excedente)
  let subtotal = 0;

  const push = (c: Componente, valor: number, base: number, detalhe: Record<string, any>) => {
    if (!valor && !detalhe?.sempre) return;
    linhas.push({ codigo: c.codigo, nome: c.nome, base: r2(base), valor: r2(valor), detalhe });
    subtotal = r2(subtotal + valor);
  };

  for (const codigo of ordem) {
    const c = mapa.get(codigo);
    if (!c || c.codigo === "cubagem") continue;
    const cfg = c.config ?? {};
    const ctx = { mercadoria, frete, subtotal, peso: pesoTaxado, volumes };

    switch (c.tipo) {
      case "frete_base": {
        const modo = String(cfg.modo ?? "fixo");
        let valor = 0;
        let base = 1;
        if (modo === "por_kg") { base = pesoTaxado; valor = base * num(cfg.valor); }
        else if (modo === "por_m3") { base = cubagem; valor = base * num(cfg.valor); }
        else if (modo === "maior") {
          base = pesoTaxado;
          valor = Math.max(pesoTaxado * num(cfg.valor), cubagem * num(cfg.valor_m3));
        } else valor = num(cfg.valor);
        const minimo = num(cfg.valor_minimo);
        const aplicouMinimo = minimo > 0 && valor < minimo;
        if (aplicouMinimo) valor = minimo;
        frete = r2(frete + valor);
        push(c, valor, base, { modo, aplicou_minimo: aplicouMinimo, sempre: true, rota: cfg.rota ?? null, servico: cfg.servico ?? null, modalidade: cfg.modalidade ?? null });
        break;
      }
      case "faixa_peso": {
        const faixas = (c.faixas ?? []).slice().sort((a, b) => num(a.peso_min) - num(b.peso_min));
        const f = faixas.find((x) => pesoTaxado >= num(x.peso_min) && pesoTaxado < num(x.peso_max));
        if (!f) {
          avisos.push("Peso taxado fora das faixas cadastradas na tabela.");
          break;
        }
        let valor = f.tipo_valor === "por_kg" ? pesoTaxado * num(f.valor)
          : f.tipo_valor === "percentual" ? (mercadoria * num(f.valor)) / 100
          : num(f.valor);
        if (num(f.valor_minimo) > 0 && valor < num(f.valor_minimo)) valor = num(f.valor_minimo);
        frete = r2(frete + valor);
        push(c, valor, pesoTaxado, { faixa: `${f.peso_min}–${f.peso_max} kg`, tipo_valor: f.tipo_valor, sempre: true });
        break;
      }
      case "excedente_peso": {
        const inicial = num(cfg.peso_inicial);
        const excedente = Math.max(0, pesoTaxado - inicial);
        if (excedente <= 0) break;
        const modo = String(cfg.modo ?? "por_kg");
        const valor = modo === "fixo" ? num(cfg.valor)
          : modo === "percentual" ? (frete * num(cfg.valor)) / 100
          : excedente * num(cfg.valor);
        frete = r2(frete + valor);
        push(c, valor, excedente, { modo, peso_inicial: inicial });
        break;
      }
      case "pedagio": {
        const modo = String(cfg.modo ?? "fixo");
        let valor = 0;
        let base = 1;
        if (modo === "por_eixo") { base = Math.max(1, num(entrada.eixos, num(cfg.eixos, 1))); valor = base * num(cfg.valor); }
        else if (modo === "por_100kg") { base = Math.ceil(pesoTaxado / 100); valor = base * num(cfg.valor); }
        else if (modo === "percentual") { base = frete; valor = (frete * num(cfg.valor)) / 100; }
        else valor = num(cfg.valor);
        valor = limitar(valor, cfg.minimo, cfg.maximo);
        push(c, valor, base, { modo });
        break;
      }
      case "gris":
      case "advalorem": {
        const base = baseDe(cfg, { mercadoria, frete, subtotal });
        let valor = (base * num(cfg.percentual ?? cfg.valor)) / 100;
        valor = limitar(valor, cfg.minimo, cfg.maximo);
        push(c, valor, base, { percentual: num(cfg.percentual ?? cfg.valor), base: cfg.base ?? "mercadoria" });
        break;
      }
      case "taxa_reentrega":
        if (!entrada.reentrega) break;
        { const g = valorGenerico(cfg, ctx); push(c, g.valor, g.base, g.detalhe); }
        break;
      case "taxa_devolucao":
        if (!entrada.devolucao) break;
        { const g = valorGenerico(cfg, ctx); push(c, g.valor, g.base, g.detalhe); }
        break;
      case "taxa_area_risco":
        if (!entrada.area_risco) break;
        { const g = valorGenerico(cfg, ctx); push(c, g.valor, g.base, g.detalhe); }
        break;
      case "taxa_dificuldade":
        if (!entrada.dificuldade) break;
        { const g = valorGenerico(cfg, ctx); push(c, g.valor, g.base, g.detalhe); }
        break;
      case "taxa_espera": {
        const horas = num(entrada.horas_espera);
        if (horas <= 0) break;
        const valor = limitar(horas * num(cfg.valor), cfg.minimo, cfg.maximo);
        push(c, valor, horas, { modo: "por_hora" });
        break;
      }
      case "taxa_estadia": {
        const dias = num(entrada.diarias);
        if (dias <= 0) break;
        const valor = limitar(dias * num(cfg.valor), cfg.minimo, cfg.maximo);
        push(c, valor, dias, { modo: "por_diaria" });
        break;
      }
      default: {
        const g = valorGenerico(cfg, ctx);
        push(c, g.valor, g.base, g.detalhe);
        break;
      }
    }
  }

  const descontoPct = num(entrada.desconto_percentual);
  const desconto = r2((subtotal * descontoPct) / 100);
  const total = r2(Math.max(0, subtotal - desconto));

  return { peso_cubado: pesoCubado, peso_taxado: pesoTaxado, linhas, subtotal: r2(subtotal), desconto, total, avisos };
}
