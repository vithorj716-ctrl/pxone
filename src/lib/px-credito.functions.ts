import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SaldoCliente = {
  cliente_id: string;
  limite_credito: number;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  liberado_ate: string | null;
  utilizado: number;
  vencido: number;
  disponivel: number;
};

export const getCreditoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [credito, saldo, lanc] = await Promise.all([
      sb.from("px_cliente_credito").select("*").eq("cliente_id", data.cliente_id).maybeSingle(),
      sb.from("px_cliente_saldo").select("*").eq("cliente_id", data.cliente_id).maybeSingle(),
      sb.from("px_cliente_lancamentos").select("*").eq("cliente_id", data.cliente_id)
        .order("vencimento", { ascending: true }).limit(50),
    ]);
    return {
      credito: credito.data ?? null,
      saldo: (saldo.data ?? null) as SaldoCliente | null,
      lancamentos: lanc.data ?? [],
    };
  });

export const upsertCreditoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    cliente_id: string;
    limite_credito?: number;
    prazo_dias?: number;
    dia_fechamento?: number | null;
    dia_vencimento?: number | null;
    bloqueado?: boolean;
    motivo_bloqueio?: string | null;
    liberado_ate?: string | null;
    observacoes?: string | null;
  }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { cliente_id, ...rest } = data;
    const existing = await sb.from("px_cliente_credito").select("id").eq("cliente_id", cliente_id).maybeSingle();
    if (existing.data?.id) {
      const { data: upd, error } = await sb.from("px_cliente_credito")
        .update(rest).eq("id", existing.data.id).select("*").single();
      if (error) throw new Error(error.message);
      return upd;
    }
    const { data: ins, error } = await sb.from("px_cliente_credito")
      .insert({ cliente_id, ...rest }).select("*").single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const liberarBloqueio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; ate: string; motivo?: string }) => {
    if (!d?.cliente_id || !d?.ate) throw new Error("cliente_id e ate obrigatórios");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("px_cliente_credito")
      .update({ liberado_ate: data.ate, liberado_por: context.userId, observacoes: data.motivo ?? null })
      .eq("cliente_id", data.cliente_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarLancamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    cliente_id: string;
    tipo: "debito" | "credito";
    origem: "minuta" | "pagamento" | "ajuste" | "estorno" | "manual";
    referencia_id?: string | null;
    referencia_tipo?: string | null;
    descricao: string;
    valor: number;
    vencimento?: string | null;
  }) => {
    if (!d?.cliente_id || !d?.descricao || d.valor == null) throw new Error("Dados incompletos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error, data: row } = await sb.from("px_cliente_lancamentos")
      .insert({ ...data, created_by: context.userId }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });
