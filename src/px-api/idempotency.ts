// PX API — Idempotência para operações de escrita (POST).
// Uso: cliente envia header `Idempotency-Key: <uuid>`. Se a mesma chave for
// reenviada (com o mesmo body) em até 24h, devolvemos a resposta original.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type IdempotencyHit = {
  status: number;
  body: unknown;
};

export async function lookupIdempotency(
  supabase: SupabaseClient,
  args: { apiClientId: string; key: string; endpoint: string; method: string; requestHash: string },
): Promise<IdempotencyHit | null> {
  const { data, error } = await (supabase as any)
    .from("px_api_idempotency")
    .select("response_status, response_body, request_hash, expires_at")
    .eq("api_client_id", args.apiClientId)
    .eq("idempotency_key", args.key)
    .eq("endpoint", args.endpoint)
    .eq("method", args.method)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.request_hash !== args.requestHash) {
    // Mesma chave, body diferente: tratado como conflito pelo chamador.
    return { status: 409, body: { conflict: true } };
  }
  return { status: data.response_status, body: data.response_body };
}

export async function saveIdempotency(
  supabase: SupabaseClient,
  args: {
    apiClientId: string; key: string; endpoint: string; method: string;
    requestHash: string; responseStatus: number; responseBody: unknown;
  },
): Promise<void> {
  try {
    await (supabase as any).from("px_api_idempotency").insert({
      api_client_id: args.apiClientId,
      idempotency_key: args.key,
      endpoint: args.endpoint,
      method: args.method,
      request_hash: args.requestHash,
      response_status: args.responseStatus,
      response_body: args.responseBody,
    });
  } catch {
    // Conflito de chave (concorrência) — ignoramos.
  }
}
