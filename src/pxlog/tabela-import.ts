// Importador flexível de tabelas comerciais (XLSX / CSV / JSON / XML).
// Trabalha por MAPEAMENTO de colunas — nunca por layout fixo.

import { parseDecimal, parseValorComTipo } from "./num";
import type { BaseCalculo, ModoCobranca, RegraComercial, TipoRegra } from "./regra-engine";

export type ArquivoLido = { colunas: string[]; linhas: Record<string, string>[] };

export type DestinoCampo =
  | "ignorar"
  | "tabela"
  | "cliente"
  | "origem"
  | "destino"
  | "rota"
  | "servico"
  | "faixa_min"
  | "faixa_max"
  | "prazo"
  | "regra";

export type MapeamentoColuna = {
  coluna: string;
  destino: DestinoCampo;
  // usados quando destino === "regra"
  nome?: string;
  tipo?: TipoRegra;
  modo?: ModoCobranca;
  base_calculo?: BaseCalculo;
  unidade?: string | null;
  servico_id?: string | null;
};

export type ProblemaImport = {
  linha: number;
  coluna: string;
  valor: string;
  mensagem: string;
  nivel: "erro" | "vinculo" | "aviso";
};

export type TabelaImportada = {
  chave: string;
  nome: string;
  cliente_texto: string | null;
  origem: string | null;
  destino: string | null;
  rota_texto: string | null;
  prazo_dias: number | null;
  regras: RegraComercial[];
};

export type ResultadoImport = {
  tabelas: TabelaImportada[];
  problemas: ProblemaImport[];
  totalRegras: number;
};

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** CSV simples com suporte a aspas e separador , ou ; */
export function parseCSV(conteudo: string): ArquivoLido {
  const texto = conteudo.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sep = (texto.split("\n")[0] ?? "").split(";").length > (texto.split("\n")[0] ?? "").split(",").length ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let atual: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { atual.push(campo); campo = ""; }
    else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
    else campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }
  const head = (linhas.shift() ?? []).map((h) => h.trim());
  return {
    colunas: head,
    linhas: linhas
      .filter((l) => l.some((c) => c.trim() !== ""))
      .map((l) => Object.fromEntries(head.map((h, i) => [h, txt(l[i])]))),
  };
}

export function parseJSONTabela(conteudo: string): ArquivoLido {
  const dados = JSON.parse(conteudo);
  const arr: any[] = Array.isArray(dados) ? dados : Array.isArray(dados?.linhas) ? dados.linhas : Array.isArray(dados?.items) ? dados.items : [];
  const colunas: string[] = [];
  for (const o of arr) for (const k of Object.keys(o ?? {})) if (!colunas.includes(k)) colunas.push(k);
  return { colunas, linhas: arr.map((o) => Object.fromEntries(colunas.map((c) => [c, txt(o?.[c])]))) };
}

export function parseXMLTabela(conteudo: string): ArquivoLido {
  const doc = new DOMParser().parseFromString(conteudo, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido.");
  const raiz = doc.documentElement;
  const filhos = Array.from(raiz.children);
  // agrupa pelo nome de tag mais frequente (ex.: <linha>, <row>, <registro>)
  const cont = new Map<string, number>();
  filhos.forEach((f) => cont.set(f.tagName, (cont.get(f.tagName) ?? 0) + 1));
  const tag = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const registros = filhos.filter((f) => f.tagName === tag);
  const colunas: string[] = [];
  const linhas = registros.map((r) => {
    const o: Record<string, string> = {};
    for (const a of Array.from(r.attributes)) { o[a.name] = txt(a.value); if (!colunas.includes(a.name)) colunas.push(a.name); }
    for (const c of Array.from(r.children)) { o[c.tagName] = txt(c.textContent); if (!colunas.includes(c.tagName)) colunas.push(c.tagName); }
    return o;
  });
  return { colunas, linhas };
}

/** Sugere um destino para cada coluna a partir do cabeçalho (o usuário sempre pode trocar). */
export function sugerirMapeamento(colunas: string[]): MapeamentoColuna[] {
  return colunas.map((coluna) => {
    const c = coluna
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const m = (destino: DestinoCampo, extra: Partial<MapeamentoColuna> = {}): MapeamentoColuna => ({ coluna, destino, ...extra });
    if (/(cliente|tomador|contratante)/.test(c)) return m("cliente");
    if (/origem|cidade.*orig|remetente/.test(c)) return m("origem");
    if (/destino|cidade.*dest|destinat/.test(c)) return m("destino");
    if (/rota|trecho|lane/.test(c)) return m("rota");
    if (/tabela|nome/.test(c)) return m("tabela");
    if (/prazo/.test(c)) return m("prazo");
    if (/(faixa|peso).*(inicial|min|de$)/.test(c)) return m("faixa_min");
    if (/(faixa|peso).*(final|max|ate)/.test(c)) return m("faixa_max");
    if (/kg|quilo/.test(c)) return m("regra", { nome: coluna, tipo: "frete", modo: "por_kg", base_calculo: "peso_taxado", unidade: "kg" });
    if (/m3|m³|cubag/.test(c)) return m("regra", { nome: coluna, tipo: "frete", modo: "por_m3", base_calculo: "cubagem", unidade: "m3" });
    if (/minim/.test(c)) return m("regra", { nome: "Frete mínimo", tipo: "minimo", modo: "minimo", base_calculo: "nenhuma" });
    if (/gris|ad.?valorem|seguro/.test(c)) return m("regra", { nome: coluna, tipo: "adicional", modo: "percentual", base_calculo: "valor_nota" });
    if (/coleta|entrega|pedagio|taxa|tde/.test(c)) return m("regra", { nome: coluna, tipo: "taxa", modo: "valor_fixo", base_calculo: "nenhuma" });
    if (/frete|valor|preco|preço/.test(c)) return m("regra", { nome: coluna, tipo: "frete", modo: "valor_fixo", base_calculo: "nenhuma" });
    return m("ignorar");
  });
}

/** Constrói as tabelas/regras a partir das linhas + mapeamento, validando cada célula. */
export function montarImportacao(arquivo: ArquivoLido, mapa: MapeamentoColuna[]): ResultadoImport {
  const porChave = new Map<string, TabelaImportada>();
  const problemas: ProblemaImport[] = [];
  let totalRegras = 0;

  const de = (destino: DestinoCampo) => mapa.find((m) => m.destino === destino);

  arquivo.linhas.forEach((linha, idx) => {
    const nLinha = idx + 2; // +cabeçalho
    const valorDe = (destino: DestinoCampo) => {
      const m = de(destino);
      return m ? txt(linha[m.coluna]) : "";
    };

    const cliente = valorDe("cliente") || null;
    const origem = valorDe("origem") || null;
    const destinoTxt = valorDe("destino") || null;
    const rota = valorDe("rota") || null;
    const nomeTabela =
      valorDe("tabela") ||
      [cliente, origem && destinoTxt ? `${origem} → ${destinoTxt}` : origem || destinoTxt, rota]
        .filter(Boolean)
        .join(" — ") ||
      "Tabela importada";

    const chave = [nomeTabela, cliente, origem, destinoTxt, rota].join("|").toLowerCase();
    let tabela = porChave.get(chave);
    if (!tabela) {
      tabela = {
        chave,
        nome: nomeTabela,
        cliente_texto: cliente,
        origem,
        destino: destinoTxt,
        rota_texto: rota,
        prazo_dias: parseDecimal(valorDe("prazo")),
        regras: [],
      };
      porChave.set(chave, tabela);
    }

    const faixaMin = parseDecimal(valorDe("faixa_min"));
    const faixaMaxBruto = valorDe("faixa_max");
    let faixaMax = parseDecimal(faixaMaxBruto);
    // "0-10kg" num único campo de faixa
    if (faixaMin === null && faixaMaxBruto === "" ) {
      const mFaixa = de("faixa_min");
      if (mFaixa) {
        const bruto = txt(linha[mFaixa.coluna]);
        const mm = bruto.match(/([\d.,]+)\s*[-a]\s*([\d.,]+)/i);
        if (mm) faixaMax = parseDecimal(mm[2]);
      }
    }

    for (const m of mapa) {
      if (m.destino !== "regra") continue;
      const bruto = txt(linha[m.coluna]);
      if (bruto === "") continue; // célula vazia = regra não informada nesta linha

      const lido = parseValorComTipo(bruto);
      if (!lido) {
        problemas.push({ linha: nLinha, coluna: m.coluna, valor: bruto, mensagem: "Valor numérico inválido.", nivel: "erro" });
        continue;
      }
      if (!Number.isFinite(lido.valor)) {
        problemas.push({ linha: nLinha, coluna: m.coluna, valor: bruto, mensagem: "Valor não numérico (NaN/Infinity).", nivel: "erro" });
        continue;
      }
      const modo = m.modo ?? "valor_fixo";
      if (lido.tipo === "percentual" && modo !== "percentual") {
        problemas.push({
          linha: nLinha, coluna: m.coluna, valor: bruto,
          mensagem: 'Valor veio como percentual. Defina a coluna como "Percentual" e escolha a base.',
          nivel: "erro",
        });
        continue;
      }
      if (modo === "percentual" && (!m.base_calculo || m.base_calculo === "nenhuma")) {
        problemas.push({
          linha: nLinha, coluna: m.coluna, valor: bruto,
          mensagem: "Percentual sem base de cálculo definida no mapeamento.", nivel: "erro",
        });
        continue;
      }
      if (lido.valor < 0 && modo === "minimo") {
        problemas.push({ linha: nLinha, coluna: m.coluna, valor: bruto, mensagem: "Valor mínimo não pode ser negativo.", nivel: "erro" });
        continue;
      }
      if (faixaMin !== null && faixaMax !== null && faixaMax <= faixaMin) {
        problemas.push({ linha: nLinha, coluna: m.coluna, valor: bruto, mensagem: "Faixa inválida: final menor ou igual ao inicial.", nivel: "erro" });
        continue;
      }
      if (m.destino === "regra" && m.servico_id === null && m.tipo === "servico") {
        problemas.push({ linha: nLinha, coluna: m.coluna, valor: bruto, mensagem: "Serviço não vinculado.", nivel: "vinculo" });
      }

      totalRegras++;
      tabela.regras.push({
        nome: m.nome || m.coluna,
        tipo: m.tipo ?? "taxa",
        modo,
        valor: lido.valor,
        unidade: m.unidade ?? null,
        base_calculo: m.base_calculo ?? "nenhuma",
        servico_id: m.servico_id ?? null,
        faixa_campo: faixaMin !== null || faixaMax !== null ? "peso_taxado" : null,
        faixa_min: faixaMin,
        faixa_max: faixaMax,
        ordem: tabela.regras.length * 10 + 10,
        ativo: true,
      });
    }
  });

  return { tabelas: [...porChave.values()], problemas, totalRegras };
}
