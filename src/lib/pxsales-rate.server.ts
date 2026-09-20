// PXSales — limitador de tentativas das telas públicas (portal e rastreio).
// Fica em arquivo .server.ts para não entrar no pacote do navegador.
import { getRequest } from "@tanstack/react-start/server";

export function origemChamada(): string {
  try {
    const h = getRequest()?.headers;
    return (
      h?.get("cf-connecting-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h?.get("x-real-ip") ||
      "anon"
    );
  } catch {
    return "anon";
  }
}

/** Limite de tentativas por origem; erro amigável quando estourado. */
export async function limitarTentativas(
  sb: any,
  escopo: string,
  max: number,
  janelaSeg: number,
) {
  const { data, error } = await sb.rpc("pxsales_rate_limit", {
    p_escopo: escopo,
    p_chave: origemChamada(),
    p_max: max,
    p_janela_seg: janelaSeg,
  });
  if (error) return; // nunca derruba a consulta por falha do contador
  if (data === false) throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
}
