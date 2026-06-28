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
    return brasilApiProvider.lookup(data.cnpj);
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

    if (data.id) {
      const { id, ...rest } = data;
      const { data: row, error } = await (supabase as any)
        .from("px_registry_clientes")
        .update({ ...rest, updated_by: userId, updated_at: now })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
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
