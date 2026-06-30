// PX API — HMAC-SHA256 JWT (HS256) usando Web Crypto.
// Worker-compatible: não depende de bibliotecas Node-only.

export type PxApiClaims = {
  sub: string;          // api_client_id
  sk: string;           // sistema_key
  scp: string[];        // escopos
  jti: string;          // token id (para revogação)
  iat: number;          // issued at (seconds)
  exp: number;          // expires (seconds)
};

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// Web Crypto exige BufferSource com ArrayBuffer (não SharedArrayBuffer).
// O TextEncoder pode devolver Uint8Array<ArrayBufferLike>, então copiamos.
function buf(s: string | Uint8Array): ArrayBuffer {
  const u = typeof s === "string" ? utf8(s) : s;
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    buf(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getSecret(): string {
  const s = process.env.PX_API_JWT_SECRET;
  if (!s) throw new Error("PX_API_JWT_SECRET não configurado");
  return s;
}

export async function signPxApiJwt(claims: Omit<PxApiClaims, "iat" | "exp"> & {
  iat?: number; exp: number;
}): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: PxApiClaims = {
    iat: claims.iat ?? now,
    exp: claims.exp,
    sub: claims.sub,
    sk: claims.sk,
    scp: claims.scp,
    jti: claims.jti,
  };
  const h = b64urlEncode(utf8(JSON.stringify(header)));
  const p = b64urlEncode(utf8(JSON.stringify(payload)));
  const signingInput = `${h}.${p}`;
  const key = await hmacKey(getSecret());
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf(signingInput)));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

export async function verifyPxApiJwt(token: string): Promise<PxApiClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const [h, p, s] = parts;
  const key = await hmacKey(getSecret());
  const ok = await crypto.subtle.verify("HMAC", key, buf(b64urlDecode(s)), buf(`${h}.${p}`));
  if (!ok) throw new Error("Assinatura inválida");
  let payload: PxApiClaims;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as PxApiClaims;
  } catch {
    throw new Error("Payload inválido");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("Token expirado");
  return payload;
}

// Hash determinístico de api_key/secret/refresh_token usando SHA-256 (hex).
// Suficiente porque o "segredo" original é gerado com alta entropia (>=32 bytes random).
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf(input));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

// Comparação em tempo constante (best-effort sem timingSafeEqual do Node).
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function randomToken(bytes: number = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64urlEncode(buf);
}
