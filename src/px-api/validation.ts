// PX API — Helpers de validação leve para handlers de escrita.

import { pxErr } from "./envelope";

export function onlyDigits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

export function normalizeCnpj(input: unknown): string | null {
  const d = onlyDigits(input);
  return d.length === 14 ? d : null;
}

export async function readJson(request: Request): Promise<{ ok: true; body: any } | { ok: false; response: Response }> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return { ok: true, body };
    }
    return { ok: false, response: pxErr("VALIDATION_ERROR", "Body deve ser um objeto JSON.") };
  } catch {
    return { ok: false, response: pxErr("VALIDATION_ERROR", "JSON inválido.") };
  }
}

export function pick<T extends object>(obj: any, keys: readonly (keyof T)[]): Partial<T> {
  const out: any = {};
  for (const k of keys) {
    if (obj != null && Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

export function require_(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      return `Campo obrigatório ausente: ${k}`;
    }
  }
  return null;
}

export function uf2(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}
