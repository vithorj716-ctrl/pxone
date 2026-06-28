import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCnpj, onlyDigits } from "./cnpj";

export const CATEGORIAS_CLIENTE = [
  { value: "cliente", label: "Cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "transportadora", label: "Transportadora" },
  { value: "distribuidora", label: "Distribuidora" },
  { value: "farmacia", label: "Farmácia" },
  { value: "hospital", label: "Hospital" },
  { value: "clinica", label: "Clínica" },
  { value: "industria", label: "Indústria" },
  { value: "operador_logistico", label: "Operador Logístico" },
  { value: "outros", label: "Outros" },
] as const;

export type SistemaKey = "pxlog" | "pxone" | "pxmed" | "pxfarma";

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cnpj: string }) => {
    const digits = onlyDigits(d?.cnpj || "");
    if (!isValidCnpj(digits)) throw new Error("CNPJ inválido");
    return { cnpj: digits };
  })
  .handler(async ({ data }) => {
    const { brasilApiProvider } = await import("@/px-core/registry/brasilapi-provider");
    const { receitaWsProvider } = await import("@/px-core/registry/receitaws-provider");
    const providers = [brasilApiProvider, receitaWsProvider];
    let lastErr: any = null;
    for (const p of providers) {
      try {
        return await p.lookup(data.cnpj);
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || "");
        // Try next provider on rate-limit or transient failures; stop on "not found"
        if (msg === "RATE_LIMIT" || msg.startsWith("Falha ao consultar")) continue;
        throw e;
      }
    }
    throw new Error(
      lastErr?.message === "RATE_LIMIT"
        ? "Todos os provedores de consulta estão temporariamente limitados. Tente novamente em alguns segundos."
        : lastErr?.message || "Falha na consulta de CNPJ",
    );
  });

export const findClienteByCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cnpj: string }) => {
    const digits = onlyDigits(d?.cnpj || "");
    if (digits.length !== 14) throw new Error("CNPJ inválido");
    return { cnpj: digits };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await (context.supabase as any)
      .from("px_registry_clientes")
      .select("*")
      .eq("cnpj", data.cnpj)
      .maybeSingle();
    return row ?? null;
  });

type UpsertInput = {
  id?: string | null;
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao_cadastral?: string | null;
  data_abertura?: string | null;
  natureza_juridica?: string | null;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  contato_nome?: string | null;
  contato_cargo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  observacoes?: string | null;
  condicao_pagamento?: string | null;
  limite_credito?: number | null;
  categorias?: string[];
};


export const upsertCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UpsertInput) => {
    const cnpj = onlyDigits(d?.cnpj || "");
    if (!isValidCnpj(cnpj)) throw new Error("CNPJ inválido");
    return { ...d, cnpj };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    async function audit(action: string, entity_id: string, diff: any) {
      try {
        const label = (context.claims as any)?.email ?? null;
        await (supabase as any).from("px_audit_log").insert({
          entity_type: "px_registry_clientes",
          entity_id, action, diff, user_id: userId, user_label: label,
        });
      } catch { /* non-blocking */ }
    }

    async function syncTmsCliente(reg: any) {
      try {
        const payload = {
          registry_id: reg.id,
          nome: reg.nome_fantasia || reg.razao_social || reg.cnpj,
          cnpj: reg.cnpj ?? null,
          contato: reg.contato_nome ?? null,
          telefone: reg.telefone ?? null,
          email: reg.email ?? null,
          endereco: [reg.logradouro, reg.numero, reg.complemento, reg.bairro].filter(Boolean).join(", ") || null,
          cidade: reg.cidade ?? null,
          uf: reg.uf ?? null,
          observacoes: reg.observacoes ?? null,
          ativo: reg.ativo !== false,
        };
        const { data: existing } = await (supabase as any)
          .from("tms_clientes").select("id").eq("registry_id", reg.id).maybeSingle();
        if (existing?.id) {
          await (supabase as any).from("tms_clientes").update(payload).eq("id", existing.id);
        } else {
          await (supabase as any).from("tms_clientes").insert(payload);
        }
      } catch { /* non-blocking */ }
    }

    if (data.id) {
      const { id, ...rest } = data;
      const { data: before } = await (supabase as any)
        .from("px_registry_clientes").select("*").eq("id", id).maybeSingle();
      const { data: row, error } = await (supabase as any)
        .from("px_registry_clientes")
        .update({ ...rest, updated_by: userId, updated_at: now })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const diff: Record<string, any> = {};
      if (before) for (const k of Object.keys(rest)) {
        if (JSON.stringify(before[k] ?? null) !== JSON.stringify((rest as any)[k] ?? null)) {
          diff[k] = { from: before[k] ?? null, to: (rest as any)[k] ?? null };
        }
      }
      if (Object.keys(diff).length) await audit("update", id, diff);
      await syncTmsCliente(row);
      return row;
    }

    const { data: row, error } = await (supabase as any)
      .from("px_registry_clientes")
      .insert({ ...data, created_by: userId, updated_by: userId })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Este CNPJ já está cadastrado na plataforma.");
      throw new Error(error.message);
    }
    await audit("create", row.id, { cnpj: row.cnpj, razao_social: row.razao_social });
    await syncTmsCliente(row);
    return row;
  });

export const setClienteAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ativo: boolean; motivo?: string | null }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = data.ativo
      ? { ativo: true, inativado_em: null, inativado_por: null, motivo_inativacao: null, updated_by: userId, updated_at: new Date().toISOString() }
      : { ativo: false, inativado_em: new Date().toISOString(), inativado_por: userId, motivo_inativacao: data.motivo ?? null, updated_by: userId, updated_at: new Date().toISOString() };
    const { error } = await (supabase as any).from("px_registry_clientes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    const label = (context.claims as any)?.email ?? null;
    await (supabase as any).from("px_audit_log").insert({
      entity_type: "px_registry_clientes",
      entity_id: data.id,
      action: data.ativo ? "reactivate" : "inactivate",
      diff: data.motivo ? { motivo: data.motivo } : null,
      user_id: userId, user_label: label,
    });
    return { ok: true };
  });

export const duplicateCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; novo_cnpj: string }) => {
    const cnpj = onlyDigits(d?.novo_cnpj || "");
    if (!isValidCnpj(cnpj)) throw new Error("Novo CNPJ inválido");
    if (!d?.id) throw new Error("id obrigatório");
    return { id: d.id, novo_cnpj: cnpj };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error: se } = await (supabase as any).from("px_registry_clientes").select("*").eq("id", data.id).single();
    if (se) throw new Error(se.message);
    const { id, created_at, updated_at, created_by, updated_by, ...copy } = src;
    const { data: row, error } = await (supabase as any).from("px_registry_clientes")
      .insert({ ...copy, cnpj: data.novo_cnpj, razao_social: `${src.razao_social ?? ""} (cópia)`, created_by: userId, updated_by: userId })
      .select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe cliente com esse CNPJ.");
      throw new Error(error.message);
    }
    const label = (context.claims as any)?.email ?? null;
    await (supabase as any).from("px_audit_log").insert({
      entity_type: "px_registry_clientes", entity_id: row.id, action: "duplicate",
      diff: { origem_id: data.id }, user_id: userId, user_label: label,
    });
    return row;
  });

export const linkClienteToSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; sistema_key: SistemaKey }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    if (!d?.sistema_key) throw new Error("sistema_key obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await (supabase as any)
      .from("px_registry_vinculos")
      .upsert(
        {
          cliente_id: data.cliente_id,
          sistema_key: data.sistema_key,
          vinculado_por: userId,
        },
        { onConflict: "cliente_id,sistema_key", ignoreDuplicates: true },
      );
    return { ok: true };
  });

export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { categoria?: string; search?: string; sistema?: SistemaKey } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from("px_registry_clientes").select("*").order("razao_social", { ascending: true }).limit(500);
    if (data.categoria) q = q.contains("categorias", [data.categoria]);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`razao_social.ilike.%${s}%,nome_fantasia.ilike.%${s}%,cnpj.ilike.%${onlyDigits(s)}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    if (data.sistema) {
      const ids = (rows ?? []).map((r: any) => r.id);
      if (!ids.length) return [];
      const { data: vinc } = await (context.supabase as any)
        .from("px_registry_vinculos")
        .select("cliente_id")
        .eq("sistema_key", data.sistema)
        .in("cliente_id", ids);
      const set = new Set((vinc ?? []).map((v: any) => v.cliente_id));
      return (rows ?? []).filter((r: any) => set.has(r.id));
    }

    return rows ?? [];
  });
