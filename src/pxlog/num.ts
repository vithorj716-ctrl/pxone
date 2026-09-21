// Parser numérico centralizado do módulo comercial (tabelas de frete / cotação).
// Regra de ouro: ausência (null/"" /inválido) é diferente de zero.

export type TipoValor = "percentual" | "monetario" | "numero";

/**
 * Converte uma entrada brasileira ou internacional em número.
 * "0,05" -> 0.05 | "0.05" -> 0.05 | "1.234,56" -> 1234.56 | "1,234.56" -> 1234.56
 * "R$ 50,00" -> 50 | "5%" -> 5 | "" / null / "abc" -> null
 * Nunca retorna NaN/Infinity.
 */
export function parseDecimal(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "boolean") return null;

  let s = String(input).trim();
  if (!s) return null;

  s = s.replace(/\s/g, "").replace(/^R\$/i, "").replace(/%$/, "");
  const negativo = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()]/g, "").replace(/^-/, "");
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s)) return null;

  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // o separador decimal é o que aparece por último
    if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    const casas = s.length - ultimaVirgula - 1;
    // 1,234 com 3 casas e mais de um grupo é milhar; caso contrário é decimal
    const grupos = s.split(",");
    const milhar = casas === 3 && grupos.length > 1 && grupos[0]!.length <= 3 && grupos.slice(1).every((g) => g.length === 3) && /^\d{1,3}(,\d{3})+$/.test(s);
    s = milhar ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (ultimoPonto >= 0) {
    const grupos = s.split(".");
    const milhar = grupos.length > 1 && grupos.slice(1).every((g) => g.length === 3) && grupos[0]!.length <= 3 && /^\d{1,3}(\.\d{3})+$/.test(s);
    if (milhar) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Detecta valor + tipo aparente da entrada. "0,05%" -> percentual 0.05; "R$ 50,00" -> monetário 50. */
export function parseValorComTipo(input: unknown): { valor: number; tipo: TipoValor } | null {
  const valor = parseDecimal(input);
  if (valor === null) return null;
  const s = String(input ?? "").trim();
  if (/%\s*$/.test(s)) return { valor, tipo: "percentual" };
  if (/^R\$/i.test(s)) return { valor, tipo: "monetario" };
  return { valor, tipo: "numero" };
}

/** Número obrigatório para cálculo: mantém zero, descarta ausência. */
export function numOuNulo(v: unknown): number | null {
  return parseDecimal(v);
}

/** Usa o valor quando ele existe (inclusive zero); só cai no padrão quando é ausente. */
export function ouPadrao(v: unknown, padrao: number): number {
  const n = parseDecimal(v);
  return n === null ? padrao : n;
}

export const arred2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
