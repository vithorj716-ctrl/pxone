// PXSales — leitor genérico do XML de visitas/atendimentos comerciais.
// Não assume um layout fixo: descobre qual tag representa um registro e coleta todos os campos-folha.
// Roda no navegador (DOMParser) durante a pré-visualização.

import type { RegistroXml } from "./types";
import { chaveTag, hashTexto, limpar } from "./text-extract";

const NOMES_REGISTRO = [
  "cliente","empresa","registro","visita","atendimento","contato","lead","prospect","row","item","record",
];

const TAGS_MENSAGEM = ["mensagem","mensagens","msg","message","conversa","historico","texto","fala","transcricao"];

export type ArquivoXml = {
  registros: RegistroXml[];
  tagRegistro: string;
  totalMensagens: number;
  hash: string;
};

function textoDe(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Descobre qual tag repete mais vezes carregando conteúdo — essa é a "linha" do arquivo. */
function descobrirTagRegistro(doc: Document): string | null {
  const contagem = new Map<string, number>();
  doc.querySelectorAll("*").forEach((el) => {
    if (el.children.length === 0) return;
    const k = chaveTag(el.tagName);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  });
  let melhor: { tag: string; n: number } | null = null;
  for (const [tag, n] of contagem) {
    const preferida = NOMES_REGISTRO.includes(tag) || NOMES_REGISTRO.some((p) => tag.startsWith(p));
    const peso = n * (preferida ? 10 : 1);
    const pesoMelhor = melhor ? melhor.n : 0;
    if (!melhor || peso > pesoMelhor) melhor = { tag, n: peso };
  }
  return melhor?.tag ?? null;
}

function coletarCampos(raiz: Element): { campos: Record<string, string[]>; mensagens: string[] } {
  const campos: Record<string, string[]> = {};
  const mensagens: string[] = [];

  const push = (chave: string, valor: string | null) => {
    const v = limpar(valor);
    if (!v) return;
    const k = chaveTag(chave);
    if (!k) return;
    (campos[k] ??= []).push(v);
  };

  for (const attr of Array.from(raiz.attributes)) push(attr.name, attr.value);

  const visitar = (el: Element) => {
    for (const attr of Array.from(el.attributes)) push(`${chaveTag(el.tagName)}_${attr.name}`, attr.value);
    if (el.children.length === 0) {
      const t = textoDe(el);
      const k = chaveTag(el.tagName);
      if (TAGS_MENSAGEM.includes(k)) {
        if (t) mensagens.push(t);
      }
      push(el.tagName, t);
      return;
    }
    for (const filho of Array.from(el.children)) visitar(filho);
  };

  for (const filho of Array.from(raiz.children)) visitar(filho);
  return { campos, mensagens };
}

export function parseClientesXml(conteudo: string, nomeArquivo = "arquivo.xml"): ArquivoXml {
  const texto = conteudo.replace(/^\uFEFF/, "");
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const erro = doc.querySelector("parsererror");
  if (erro) throw new Error("O arquivo XML está inválido ou corrompido e não pôde ser lido.");
  if (!doc.documentElement) throw new Error("O arquivo XML está vazio.");

  const tag = descobrirTagRegistro(doc);
  if (!tag) throw new Error("Não foi possível identificar registros de clientes dentro do XML.");

  const nós = Array.from(doc.querySelectorAll("*")).filter(
    (el) => chaveTag(el.tagName) === tag && el.children.length > 0,
  );

  const registros: RegistroXml[] = [];
  let totalMensagens = 0;

  nós.forEach((el, i) => {
    const { campos, mensagens } = coletarCampos(el);
    const conteudoTexto = textoDe(el);
    if (!conteudoTexto) return;
    const idBruto =
      el.getAttribute("id") ??
      campos["id"]?.[0] ??
      campos["codigo"]?.[0] ??
      campos["cnpj"]?.[0] ??
      `${tag}-${i + 1}`;
    totalMensagens += mensagens.length;
    registros.push({
      xmlId: String(idBruto),
      campos,
      texto: conteudoTexto,
      mensagens,
      totalMensagens: mensagens.length,
    });
  });

  if (!registros.length) throw new Error("Nenhum registro de cliente foi encontrado no XML.");

  return {
    registros,
    tagRegistro: tag,
    totalMensagens,
    hash: hashTexto(`${nomeArquivo}:${texto.length}:${texto.slice(0, 4000)}:${texto.slice(-4000)}`),
  };
}

/** Primeiro valor não vazio entre vários possíveis nomes de tag. */
export function campo(registro: RegistroXml, ...nomes: string[]): string | null {
  for (const n of nomes) {
    const v = registro.campos[chaveTag(n)]?.find((x) => x.trim().length > 0);
    if (v) return v;
  }
  return null;
}

/** Todos os valores de um conjunto de tags. */
export function campos(registro: RegistroXml, ...nomes: string[]): string[] {
  const out: string[] = [];
  for (const n of nomes) {
    for (const v of registro.campos[chaveTag(n)] ?? []) if (!out.includes(v)) out.push(v);
  }
  return out;
}
