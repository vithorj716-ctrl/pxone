// PX API — server functions internas para administração de API Clients.
// Usadas pelo painel /admin no PXOne (executivos).
//
// Não expõem a api_key/secret após criação — devolvem o valor em texto puro
// UMA ÚNICA VEZ (no ato da criação). Em seguida só ficam disponíveis o prefix
// e os hashes.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex, randomToken } from "@/px-api/jwt";

const ESCOPOS_VALIDOS = [
  "clientes:read",
  "clientes:write",
  "enderecos:read",
  "enderecos:write",
  "contatos:read",
  "contatos:write",
  "financeiro:read",
  "usuarios:read",
  "empresas:read",
  "permissoes:read",
  "perfis:read",
  "categorias:read",
  "tabela-frete:read",
  "admin:write",
];

async function assertExecutivo(ctx: any): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("is_executive", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas executivos podem gerenciar a PX API.");
}

export const listApiClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertExecutivo(context);
    const { data, error } = await (context.supabase as any)
      .from("px_api_clients")
      .select("id, sistema_key, nome, descricao, api_key_prefix, escopos, rate_limit_rpm, ativo, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    sistema_key: string;
    nome: string;
    descricao?: string;
    escopos: string[];
    rate_limit_rpm?: number;
    allowed_origins?: string[];
  }) => {
    if (!d?.sistema_key?.trim()) throw new Error("sistema_key obrigatório");
    if (!d?.nome?.trim()) throw new Error("nome obrigatório");
    const escopos = (d.escopos ?? []).filter((s) => ESCOPOS_VALIDOS.includes(s));
    return {
      ...d,
      sistema_key: d.sistema_key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
      escopos,
      rate_limit_rpm: Math.max(1, Math.min(10_000, d.rate_limit_rpm ?? 120)),
      allowed_origins: d.allowed_origins ?? [],
    };
  })
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    const apiKey = `pxa_${randomToken(20)}`;
    const secret = `pxs_${randomToken(32)}`;
    const apiKeyHash = await sha256Hex(apiKey);
    const secretHash = await sha256Hex(secret);
    const prefix = apiKey.slice(0, 12);

    const { data: row, error } = await (context.supabase as any)
      .from("px_api_clients")
      .insert({
        sistema_key: data.sistema_key,
        nome: data.nome,
        descricao: data.descricao ?? null,
        api_key_prefix: prefix,
        api_key_hash: apiKeyHash,
        secret_hash: secretHash,
        escopos: data.escopos,
        rate_limit_rpm: data.rate_limit_rpm,
        allowed_origins: data.allowed_origins,
        criado_por: context.userId,
      })
      .select("id, sistema_key, nome, api_key_prefix, escopos, rate_limit_rpm, ativo, created_at")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um sistema com essa sistema_key.");
      throw new Error(error.message);
    }
    return {
      client: row,
      // Devolvidas UMA ÚNICA VEZ:
      api_key: apiKey,
      secret,
    };
  });

export const setApiClientAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo: boolean }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    const { error } = await (context.supabase as any)
      .from("px_api_clients").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    const { error } = await (context.supabase as any)
      .from("px_api_tokens")
      .update({ revogado: true, revogado_em: new Date().toISOString(), revogado_por: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listApiLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sistema_key?: string; limit?: number; status?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertExecutivo(context);
    const limit = Math.min(500, Math.max(1, data?.limit ?? 100));
    let q = (context.supabase as any)
      .from("px_api_logs")
      .select("id, api_client_id, sistema_key, request_id, metodo, endpoint, status, latencia_ms, ip, erro_codigo, erro_mensagem, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data?.sistema_key) q = q.eq("sistema_key", data.sistema_key);
    if (typeof data?.status === "number") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const PX_API_ESCOPOS = ESCOPOS_VALIDOS;
