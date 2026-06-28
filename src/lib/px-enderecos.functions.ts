import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TIPOS_ENDERECO = [
  { value: "matriz", label: "Matriz" },
  { value: "filial", label: "Filial" },
  { value: "cd", label: "Centro de Distribuição" },
  { value: "hospital", label: "Hospital" },
  { value: "farmacia", label: "Farmácia" },
  { value: "clinica", label: "Clínica" },
  { value: "deposito", label: "Depósito" },
  { value: "outro", label: "Outro" },
] as const;

export const SETORES_CONTATO = [
  { value: "recebimento", label: "Recebimento" },
  { value: "expedicao", label: "Expedição" },
  { value: "compras", label: "Compras" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
  { value: "operacional", label: "Operacional" },
  { value: "outro", label: "Outro" },
] as const;

export const RESTRICOES_PADRAO = [
  "Recebe apenas até 17h",
  "Necessário agendamento",
  "Entrada pelos fundos",
  "Exigir nota fiscal",
  "Portaria controlada",
  "Doca específica",
  "Veículo pequeno apenas",
  "Não recebe finais de semana",
] as const;

export type EnderecoInput = {
  id?: string | null;
  cliente_id: string;
  tipo: string;
  apelido?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ponto_referencia?: string | null;
  observacoes?: string | null;
  janela_recebimento?: string | null;
  restricoes?: string[];
  is_padrao_remetente?: boolean;
  is_padrao_destinatario?: boolean;
  ativo?: boolean;
};

export const listEnderecos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("px_registry_enderecos")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("is_padrao_remetente", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: EnderecoInput) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    if (!d?.tipo) throw new Error("tipo obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const payload: any = {
      ...rest,
      restricoes: rest.restricoes ?? [],
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { data: row, error } = await (supabase as any)
        .from("px_registry_enderecos").update(payload).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    payload.created_by = userId;
    const { data: row, error } = await (supabase as any)
      .from("px_registry_enderecos").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("px_registry_enderecos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ContatoInput = {
  id?: string | null;
  cliente_id: string;
  endereco_id?: string | null;
  setor: string;
  nome: string;
  cargo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  is_principal?: boolean;
  observacoes?: string | null;
};

export const listContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id?: string; endereco_id?: string }) => {
    if (!d?.cliente_id && !d?.endereco_id) throw new Error("cliente_id ou endereco_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from("px_registry_contatos").select("*");
    if (data.endereco_id) q = q.eq("endereco_id", data.endereco_id);
    else if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    q = q.order("is_principal", { ascending: false }).order("created_at", { ascending: true });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ContatoInput) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    if (!d?.nome) throw new Error("nome obrigatório");
    if (!d?.setor) throw new Error("setor obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const payload: any = { ...rest, updated_by: userId, updated_at: new Date().toISOString() };
    if (id) {
      const { data: row, error } = await (supabase as any)
        .from("px_registry_contatos").update(payload).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    payload.created_by = userId;
    const { data: row, error } = await (supabase as any)
      .from("px_registry_contatos").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("px_registry_contatos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
