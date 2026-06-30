// Cliente HTTP base usado pelos SDKs de CRM e TMS.
// Recursos: timeout, retries com backoff, circuit breaker simples e cache opcional.

import {
  PX_INTEGRATION_CACHE_TTL_MS,
  PX_INTEGRATION_RETRIES,
  PX_INTEGRATION_TIMEOUT_MS,
  getSistemaConfig,
  type PxSistema,
} from "./config";
import { cacheGet, cacheSet } from "./cache";
import { PxIntegrationError } from "./errors";

type BreakerState = { fails: number; openedAt: number };
const breakers = new Map<PxSistema, BreakerState>();
const FAIL_THRESHOLD = 5;
const OPEN_MS = 30_000;

function breaker(sistema: PxSistema): BreakerState {
  let b = breakers.get(sistema);
  if (!b) { b = { fails: 0, openedAt: 0 }; breakers.set(sistema, b); }
  return b;
}

function isOpen(sistema: PxSistema): boolean {
  const b = breaker(sistema);
  if (!b.openedAt) return false;
  if (Date.now() - b.openedAt < OPEN_MS) return true;
  // semi-open: zera e deixa tentar
  b.openedAt = 0;
  b.fails = 0;
  return false;
}

function recordSuccess(sistema: PxSistema) {
  const b = breaker(sistema);
  b.fails = 0;
  b.openedAt = 0;
}

function recordFailure(sistema: PxSistema) {
  const b = breaker(sistema);
  b.fails += 1;
  if (b.fails >= FAIL_THRESHOLD) b.openedAt = Date.now();
}

// Token cache por sistema (client_credentials no padrão da PX API)
const tokenStore = new Map<PxSistema, { token: string; expiresAt: number }>();

async function getToken(sistema: PxSistema): Promise<string | null> {
  const cfg = getSistemaConfig(sistema);
  if (!cfg.configured || !cfg.clientId || !cfg.clientSecret) return null;
  const existing = tokenStore.get(sistema);
  if (existing && existing.expiresAt > Date.now() + 30_000) return existing.token;

  const res = await fetch(`${cfg.baseUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new PxIntegrationError({
      code: res.status === 401 ? "UNAUTHORIZED" : "UPSTREAM_4XX",
      sistema,
      status: res.status,
      message: `Falha ao autenticar no ${sistema}`,
    });
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number; data?: { access_token: string; expires_in: number } };
  const token = body.access_token ?? body.data?.access_token;
  const expIn = body.expires_in ?? body.data?.expires_in ?? 3600;
  if (!token) throw new PxIntegrationError({ code: "PARSE", sistema, message: "Resposta de token inválida" });
  tokenStore.set(sistema, { token, expiresAt: Date.now() + expIn * 1000 });
  return token;
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;                  // ex: "/clientes"
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  cache?: { key: string; ttlMs?: number };
  idempotencyKey?: string;
};

export async function pxRequest<T = unknown>(sistema: PxSistema, opts: RequestOptions): Promise<T> {
  const cfg = getSistemaConfig(sistema);
  if (!cfg.configured || !cfg.baseUrl) {
    throw new PxIntegrationError({
      code: "STANDBY",
      sistema,
      message: `${sistema.toUpperCase()} ainda não está configurado (URL ausente). Integração em standby.`,
    });
  }

  // cache de leitura
  if (opts.cache && (opts.method ?? "GET") === "GET") {
    const hit = cacheGet<T>(opts.cache.key);
    if (hit !== undefined) return hit;
  }

  if (isOpen(sistema)) {
    throw new PxIntegrationError({
      code: "CIRCUIT_OPEN",
      sistema,
      message: `${sistema} temporariamente indisponível (circuit breaker aberto). Tente novamente em instantes.`,
    });
  }

  const token = await getToken(sistema).catch((e) => { throw e; });
  const qs = opts.query
    ? "?" + new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  const url = `${cfg.baseUrl}${opts.path}${qs}`;
  const method = opts.method ?? "GET";

  let lastErr: unknown = null;
  const maxAttempts = PX_INTEGRATION_RETRIES + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PX_INTEGRATION_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Accept": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status >= 500) {
        recordFailure(sistema);
        lastErr = new PxIntegrationError({
          code: "UPSTREAM_5XX",
          sistema,
          status: res.status,
          message: `${sistema} respondeu ${res.status}`,
        });
        // retry
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        recordFailure(sistema);
        let body: unknown = null;
        try { body = await res.json(); } catch { /* noop */ }
        throw new PxIntegrationError({
          code: res.status === 401 ? "UNAUTHORIZED" : "UPSTREAM_4XX",
          sistema,
          status: res.status,
          message: `${sistema} respondeu ${res.status}`,
          upstreamBody: body,
        });
      }

      recordSuccess(sistema);
      const json = (await res.json()) as T;
      if (opts.cache && method === "GET") {
        cacheSet(opts.cache.key, json, opts.cache.ttlMs ?? PX_INTEGRATION_CACHE_TTL_MS);
      }
      return json;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof PxIntegrationError) {
        if (err.code === "UPSTREAM_5XX" && attempt < maxAttempts - 1) { lastErr = err; continue; }
        throw err;
      }
      const aborted = (err as { name?: string })?.name === "AbortError";
      recordFailure(sistema);
      lastErr = new PxIntegrationError({
        code: aborted ? "TIMEOUT" : "NETWORK",
        sistema,
        message: aborted ? `${sistema} não respondeu no tempo limite` : `Falha de rede ao chamar ${sistema}`,
      });
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr ?? new PxIntegrationError({ code: "NETWORK", sistema, message: "Falha desconhecida" });
}

export function getIntegrationStatus(sistema: PxSistema): {
  sistema: PxSistema;
  configured: boolean;
  circuitOpen: boolean;
  fails: number;
} {
  const cfg = getSistemaConfig(sistema);
  const b = breaker(sistema);
  return {
    sistema,
    configured: cfg.configured,
    circuitOpen: Boolean(b.openedAt) && Date.now() - b.openedAt < OPEN_MS,
    fails: b.fails,
  };
}
