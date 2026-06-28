export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function formatCnpj(v: string): string {
  const d = onlyDigits(v).padStart(14, "0").slice(-14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string) => {
    let len = base.length;
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += Number(base.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calc(cnpj.slice(0, 12));
  if (d1 !== Number(cnpj.charAt(12))) return false;
  const d2 = calc(cnpj.slice(0, 13));
  if (d2 !== Number(cnpj.charAt(13))) return false;
  return true;
}

export const SITUACOES_INAPTAS = ["INAPTA", "BAIXADA", "SUSPENSA", "NULA"];

export function isSituacaoOk(situacao?: string | null): boolean {
  if (!situacao) return true;
  return !SITUACOES_INAPTAS.includes(situacao.toUpperCase());
}
