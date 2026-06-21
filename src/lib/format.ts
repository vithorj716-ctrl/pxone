export function formatBRL(value: number, compact = true): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
