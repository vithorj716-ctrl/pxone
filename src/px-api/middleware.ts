// PX API — Middleware de autenticação, autorização (escopos),
// rate-limit simples e logging para rotas /api/public/v1/*.
//
// Uso em uma rota:
//
//   export const Route = createFileRoute("/api/public/v1/clientes")({
//     server: { handlers: {
//       GET: async ({ request }) => withPxApi(request, { scopes: ["clientes:read"] }, async (ctx) => {
//         // ctx.supabase, ctx.client, ctx.requestId, ctx.claims
//         return pxOk({...}, { requestId: ctx.requestId });
//       }),
//     }},
//   });

import { verifyPxApiJwt, type PxApiClaims } from "./jwt";
import { pxErr, getRequestId } from "./envelope";
import { getPxApiSupabase } from "./server-client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PxApiContext = {
  request: Request;
  requestId: string;
  claims: PxApiClaims;
  client: { id: string; sistema_key: string; nome: string; rate_limit_rpm: number; escopos: string[] };
  supabase: SupabaseClient;
};

export type PxApiOptions = {
  scopes?: string[];          // todos esses escopos devem estar presentes
  anyScope?: string[];        // pelo menos um destes
};

function getClientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function hasAllScopes(have: string[], need: string[]): boolean {
  return need.every((s) => have.includes(s));
}

async function logRequest(
  supabase: SupabaseClient,
  data: {
    api_client_id: string | null;
    sistema_key: string | null;
    request_id: string;
    metodo: string;
    endpoint: string;
    status: number;
    latencia_ms: number;
    ip: string | null;
    user_agent: string | null;
    erro_codigo?: string | null;
    erro_mensagem?: string | null;
  },
): Promise<void> {
  try {
    await (supabase as any).from("px_api_logs").insert(data);
  } catch {
    // Log nunca pode quebrar a resposta.
  }
}

export async function withPxApi(
  request: Request,
  options: PxApiOptions,
  handler: (ctx: PxApiContext) => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const requestId = getRequestId(request);
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent");
  const supabase = await getPxApiSupabase();

  const finish = async (resp: Response, opts: { apiClientId: string | null; sistemaKey: string | null; errCode?: string; errMsg?: string }) => {
    await logRequest(supabase, {
      api_client_id: opts.apiClientId,
      sistema_key: opts.sistemaKey,
      request_id: requestId,
      metodo: request.method,
      endpoint,
      status: resp.status,
      latencia_ms: Date.now() - started,
      ip,
      user_agent: ua,
      erro_codigo: opts.errCode ?? null,
      erro_mensagem: opts.errMsg ?? null,
    });
    return resp;
  };

  // 1) Bearer token
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return finish(
      pxErr("UNAUTHORIZED", "Token de autenticação ausente.", { requestId }),
      { apiClientId: null, sistemaKey: null, errCode: "UNAUTHORIZED", errMsg: "missing bearer" },
    );
  }
  const token = auth.slice(7).trim();

  // 2) Verifica JWT
  let claims: PxApiClaims;
  try {
    claims = await verifyPxApiJwt(token);
  } catch (e: any) {
    return finish(
      pxErr("UNAUTHORIZED", "Token inválido ou expirado.", { requestId }),
      { apiClientId: null, sistemaKey: null, errCode: "UNAUTHORIZED", errMsg: String(e?.message ?? e) },
    );
  }

  // 3) Verifica revogação + carrega cliente ativo
  const [{ data: tokenRow }, { data: clientRow }] = await Promise.all([
    (supabase as any).from("px_api_tokens").select("revogado, expires_at").eq("jti", claims.jti).maybeSingle(),
    (supabase as any).from("px_api_clients").select("id, sistema_key, nome, ativo, rate_limit_rpm, escopos").eq("id", claims.sub).maybeSingle(),
  ]);

  if (!tokenRow || tokenRow.revogado) {
    return finish(
      pxErr("UNAUTHORIZED", "Token revogado.", { requestId }),
      { apiClientId: claims.sub, sistemaKey: claims.sk, errCode: "UNAUTHORIZED", errMsg: "revoked" },
    );
  }
  if (!clientRow || !clientRow.ativo) {
    return finish(
      pxErr("UNAUTHORIZED", "Sistema consumidor inativo.", { requestId }),
      { apiClientId: claims.sub, sistemaKey: claims.sk, errCode: "UNAUTHORIZED", errMsg: "client inactive" },
    );
  }

  // 4) Escopos
  const needAll = options.scopes ?? [];
  if (needAll.length && !hasAllScopes(claims.scp ?? [], needAll)) {
    return finish(
      pxErr("FORBIDDEN", `Escopos insuficientes. Necessário: ${needAll.join(", ")}`, { requestId }),
      { apiClientId: claims.sub, sistemaKey: claims.sk, errCode: "FORBIDDEN", errMsg: "missing scope" },
    );
  }
  if (options.anyScope?.length && !options.anyScope.some((s) => claims.scp.includes(s))) {
    return finish(
      pxErr("FORBIDDEN", `Pelo menos um escopo necessário: ${options.anyScope.join(", ")}`, { requestId }),
      { apiClientId: claims.sub, sistemaKey: claims.sk, errCode: "FORBIDDEN", errMsg: "missing any scope" },
    );
  }

  // 5) Rate limit (janela de 60s sobre px_api_logs do mesmo client)
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const { count } = await (supabase as any)
    .from("px_api_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_client_id", clientRow.id)
    .gte("created_at", sinceIso);
  const limit = clientRow.rate_limit_rpm ?? 120;
  if (typeof count === "number" && count >= limit) {
    return finish(
      pxErr("RATE_LIMITED", `Limite de ${limit} req/min excedido.`, {
        requestId,
        headers: { "retry-after": "30" },
      }),
      { apiClientId: clientRow.id, sistemaKey: clientRow.sistema_key, errCode: "RATE_LIMITED" },
    );
  }

  // 6) Executa o handler
  try {
    const resp = await handler({
      request,
      requestId,
      claims,
      client: {
        id: clientRow.id,
        sistema_key: clientRow.sistema_key,
        nome: clientRow.nome,
        rate_limit_rpm: limit,
        escopos: clientRow.escopos ?? [],
      },
      supabase,
    });
    return finish(resp, { apiClientId: clientRow.id, sistemaKey: clientRow.sistema_key });
  } catch (e: any) {
    console.error("[px-api]", endpoint, e);
    return finish(
      pxErr("INTERNAL", "Erro interno.", { requestId }),
      { apiClientId: clientRow.id, sistemaKey: clientRow.sistema_key, errCode: "INTERNAL", errMsg: String(e?.message ?? e) },
    );
  }
}
