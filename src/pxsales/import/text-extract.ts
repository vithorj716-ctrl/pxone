// PXSales — extratores de dados a partir de texto livre (observações, mensagens de visita).
// Puro, sem dependência de DOM ou de rede: usado no cliente (pré-visualização) e no servidor (validação).

import { isValidCnpj, onlyDigits } from "@/lib/cnpj";

export function semAcento(v: string): string {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function chaveTag(v: string): string {
  return semAcento(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function limpar(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

export function titulo(v: string | null | undefined): string | null {
  const t = limpar(v);
  if (!t) return null;
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "em", "para"]);
  return t
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/** Todos os CNPJs válidos encontrados no texto, sem repetição e na ordem de aparição. */
export function extrairCnpjs(texto: string): string[] {
  const out: string[] = [];
  const re = /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b|\b\d{14}\b/g;
  for (const m of texto.matchAll(re)) {
    const d = onlyDigits(m[0]);
    if (d.length === 14 && isValidCnpj(d) && !out.includes(d)) out.push(d);
  }
  return out;
}

export function extrairCpf(texto: string): string | null {
  const m = texto.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  return m ? onlyDigits(m[0]) : null;
}

export function extrairInscricaoEstadual(texto: string): string | null {
  const m = texto.match(/\b(?:i\.?e\.?|inscri[çc][aã]o\s+estadual)\s*[:\-]?\s*([0-9.\-/]{6,20})/i);
  return m?.[1] ? m[1].replace(/\s+/g, "") : null;
}

export function extrairCep(texto: string): string | null {
  const m = texto.match(/\b\d{5}[-.\s]?\d{3}\b/);
  if (!m) return null;
  const d = onlyDigits(m[0]);
  return d.length === 8 ? d : null;
}

/** Telefones brasileiros (fixo e celular), normalizados para dígitos com DDD. */
export function extrairTelefones(texto: string): string[] {
  const out: string[] = [];
  const re = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]?)?(?:9\s?)?\d{4}[\s.-]?\d{4}\b/g;
  for (const m of texto.matchAll(re)) {
    let d = onlyDigits(m[0]);
    if (d.startsWith("55") && d.length > 11) d = d.slice(2);
    if (d.length !== 10 && d.length !== 11) continue;
    const ddd = Number(d.slice(0, 2));
    if (ddd < 11 || ddd > 99) continue;
    if (/^(\d)\1+$/.test(d)) continue;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

export function ehCelular(telefone: string): boolean {
  const d = onlyDigits(telefone);
  return d.length === 11 && d.charAt(2) === "9";
}

export function extrairEmails(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi)) {
    const e = m[0].toLowerCase().replace(/[.,;)]+$/, "");
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

export function extrairUf(texto: string): string | null {
  const t = semAcento(texto).toUpperCase();
  const m = t.match(/[\s,/\-]([A-Z]{2})\b/g);
  for (const bruto of m ?? []) {
    const uf = bruto.replace(/[^A-Z]/g, "");
    if (UFS.includes(uf)) return uf;
  }
  return null;
}

/** "São Paulo/SP", "Cidade - SP", "Cidade, SP" */
export function extrairCidadeUf(texto: string): { cidade: string | null; uf: string | null } {
  const m = texto.match(/([A-Za-zÀ-ÿ'´`^~.\s]{3,40})\s*[/\-,]\s*([A-Za-z]{2})\b/);
  if (m) {
    const uf = semAcento(m[2] ?? "").toUpperCase();
    if (UFS.includes(uf)) return { cidade: titulo(m[1] ?? ""), uf };
  }
  return { cidade: null, uf: extrairUf(texto) };
}

/** R$ 12.500,00 / 12500 / 12,5 mil */
export function extrairValor(texto: string): number | null {
  const mil = texto.match(/r?\$?\s*([\d.,]+)\s*mil\b/i);
  if (mil?.[1]) {
    const n = paraNumero(mil[1]);
    if (n != null) return n * 1000;
  }
  const m = texto.match(/r\$\s*([\d.,]+)/i);
  if (m?.[1]) return paraNumero(m[1]);
  return null;
}

export function paraNumero(v: string): number | null {
  const t = v.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function extrairPrazoPagamento(texto: string): number | null {
  const m = texto.match(/(\d{1,3})\s*(?:dd|dias?)\b/i);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (n > 0 && n <= 365) return n;
  }
  if (/\b(?:[àa]\s*vista|pagamento\s+imediato)\b/i.test(texto)) return 0;
  return null;
}

const MAPA_FREQUENCIA: [RegExp, string][] = [
  [/di[áa]ri[ao]|todo\s+dia/i, "Diária"],
  [/\b\d\s*x\s*(?:por\s*)?semana|semanal/i, "Semanal"],
  [/quinzenal/i, "Quinzenal"],
  [/mensal|uma\s+vez\s+(?:por|ao)\s+m[êe]s/i, "Mensal"],
  [/esporádic|eventual|spot/i, "Esporádica"],
];

export function extrairFrequencia(texto: string): string | null {
  for (const [re, label] of MAPA_FREQUENCIA) if (re.test(texto)) return label;
  return null;
}

const MAPA_CARGA: [RegExp, string][] = [
  [/refrigerad|frio|c[âa]mara\s+fria|congelad/i, "Refrigerada"],
  [/paletizad|pallet/i, "Paletizada"],
  [/fracionad/i, "Fracionada"],
  [/lotaç[ãa]o|carga\s+fechada|ftl\b/i, "Lotação"],
  [/perigos|qu[íi]mic/i, "Perigosa"],
  [/granel/i, "Granel"],
  [/e-?commerce|last\s*mile|entrega\s+final/i, "E-commerce"],
];

export function extrairTipoCarga(texto: string): string | null {
  for (const [re, label] of MAPA_CARGA) if (re.test(texto)) return label;
  return null;
}

const MAPA_SEGMENTO: [RegExp, string][] = [
  [/aliment|bebid|food/i, "Alimentos e bebidas"],
  [/farmac|medicament|hospital/i, "Saúde e farma"],
  [/constru|materia(?:l|is)\s+de\s+constru/i, "Construção"],
  [/varejo|loja|supermerc|atacad/i, "Varejo e atacado"],
  [/ind[úu]stri|f[áa]bric|metal|plástic/i, "Indústria"],
  [/agro|fazend|gr[ãa]os/i, "Agronegócio"],
  [/eletr[ôo]nic|tecnolog/i, "Eletrônicos"],
  [/vestu[áa]ri|confec|moda|t[êe]xtil/i, "Vestuário"],
];

export function extrairSegmento(texto: string): string | null {
  for (const [re, label] of MAPA_SEGMENTO) if (re.test(texto)) return label;
  return null;
}

/** "SP x RJ", "rota São Paulo - Campinas", "atende o Nordeste" */
export function extrairRotas(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/\b([A-Z]{2})\s*(?:x|X|->|→|\/|para)\s*([A-Z]{2})\b/g)) {
    const a = m[1] ?? "";
    const b = m[2] ?? "";
    if (UFS.includes(a) && UFS.includes(b)) {
      const r = `${a} → ${b}`;
      if (!out.includes(r)) out.push(r);
    }
  }
  for (const m of texto.matchAll(/rotas?\s*[:\-]?\s*([A-Za-zÀ-ÿ\s]{3,30})\s*(?:x|-|→|para)\s*([A-Za-zÀ-ÿ\s]{3,30})/gi)) {
    const r = `${titulo(m[1] ?? "")} → ${titulo(m[2] ?? "")}`;
    if (!out.includes(r)) out.push(r);
  }
  return out.slice(0, 8);
}

export function extrairConcorrente(texto: string): string | null {
  const m = texto.match(
    /(?:concorrente|hoje\s+(?:usa|trabalha\s+com)|transportadora\s+atual|atendid[oa]\s+(?:pela|por))\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9&.\s]{3,40})/i,
  );
  return m?.[1] ? titulo(m[1].split(/[,.;\n]/)[0] ?? "") : null;
}

export function extrairVolumeMensal(texto: string): string | null {
  const m = texto.match(/(\d[\d.,]*)\s*(?:kg|quilos?|ton(?:eladas?)?|m3|m³|volumes?|entregas?|caixas?)\s*(?:\/|por\s+)?\s*(?:m[êe]s|mensa(?:l|is))?/i);
  return m?.[0] ? limpar(m[0]) : null;
}

const QUENTE = /fechou|fechado|aprovad|vamos\s+come[çc]ar|urgente|assinar|iniciar\s+opera|quer\s+cota[çc]/i;
const FRIO = /sem\s+interesse|n[ãa]o\s+tem\s+interesse|contrato\s+fechado\s+com|retornar\s+(?:ano|semestre)|n[ãa]o\s+atende/i;

export function classificarTemperatura(texto: string): "frio" | "morno" | "quente" | null {
  if (QUENTE.test(texto)) return "quente";
  if (FRIO.test(texto)) return "frio";
  return texto.trim() ? "morno" : null;
}

/** Datas em dd/mm/aaaa, dd-mm-aaaa ou ISO — devolve a mais recente em ISO (yyyy-mm-dd). */
export function extrairDataMaisRecente(texto: string): string | null {
  const datas: string[] = [];
  for (const m of texto.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) datas.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of texto.matchAll(/\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b/g)) {
    const dia = String(m[1]).padStart(2, "0");
    const mes = String(m[2]).padStart(2, "0");
    let ano = String(m[3]);
    if (ano.length === 2) ano = Number(ano) > 70 ? `19${ano}` : `20${ano}`;
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(dia) >= 1 && Number(dia) <= 31) datas.push(`${ano}-${mes}-${dia}`);
  }
  if (!datas.length) return null;
  return datas.sort().at(-1) ?? null;
}

/** Nome de pessoa a partir de "falei com João", "contato: Maria Silva". */
export function extrairNomeContato(texto: string): string | null {
  const m = texto.match(
    /(?:falei\s+com|contato\s*[:\-]|respons[áa]vel\s*[:\-]|atendid[oa]\s+por|conversei\s+com|sr\.?|sra\.?)\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ]{2,}(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]{2,}){0,2})/,
  );
  return m?.[1] ? titulo(m[1]) : null;
}

const CARGOS = [
  "comprador","compras","gerente","diretor","proprietário","proprietario","sócio","socio","supervisor",
  "coordenador","logística","logistica","financeiro","expedição","expedicao","almoxarife","encarregado",
];

export function extrairCargo(texto: string): string | null {
  const t = semAcento(texto).toLowerCase();
  for (const c of CARGOS) {
    if (t.includes(semAcento(c).toLowerCase())) return titulo(c);
  }
  return null;
}

/** "Rua X, 123 - Bairro" */
export function extrairLogradouro(texto: string): { logradouro: string | null; numero: string | null; bairro: string | null } {
  const m = texto.match(
    /\b((?:rua|av(?:enida)?|rod(?:ovia)?|travessa|alameda|estrada|praça|praca)\.?\s+[A-Za-zÀ-ÿ0-9.\s]{3,60}?)[,\s]+(\d{1,6})(?:\s*[-,]\s*([A-Za-zÀ-ÿ\s]{3,40}))?/i,
  );
  if (!m) return { logradouro: null, numero: null, bairro: null };
  return {
    logradouro: titulo(m[1] ?? ""),
    numero: limpar(m[2] ?? ""),
    bairro: titulo(m[3] ?? "") ?? null,
  };
}

/** Hash estável (FNV-1a) para deduplicação/idempotência sem depender de crypto. */
export function hashTexto(v: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let h2 = 0x1000193;
  for (let i = v.length - 1; i >= 0; i--) {
    h2 ^= v.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Nome comparável para deduplicação por razão social. */
export function chaveNome(v: string | null | undefined): string {
  const t = semAcento(v ?? "").toLowerCase();
  return t
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa|comercio|com|industria|ind|transportes?|distribuidora|dist)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
