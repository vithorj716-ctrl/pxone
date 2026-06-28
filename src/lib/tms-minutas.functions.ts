import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MOTIVOS_CANCELAMENTO = [
  { value: "solicitacao_duplicada", label: "Solicitação duplicada" },
  { value: "cliente_desistiu", label: "Cliente desistiu" },
  { value: "erro_cadastro", label: "Erro de cadastro" },
  { value: "mercadoria_nao_enviada", label: "Mercadoria não enviada" },
  { value: "carga_recusada", label: "Carga recusada" },
  { value: "problema_operacional", label: "Problema operacional" },
  { value: "outros", label: "Outros" },
] as const;

export const cancelarMinuta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { minuta_id: string; motivo: string; motivo_texto?: string }) => {
    if (!d?.minuta_id) throw new Error("minuta_id obrigatório");
    if (!d?.motivo) throw new Error("motivo obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: m } = await supabase.from("tms_minutas").select("id, cancelada_em, status").eq("id", data.minuta_id).maybeSingle() as any;
    if (!m) throw new Error("Minuta não encontrada");
    if (m.cancelada_em) throw new Error("Minuta já cancelada");
    if (m.status === "entregue") throw new Error("Minuta já entregue, não pode cancelar");

    const now = new Date().toISOString();

    await supabase.from("tms_minutas").update({
      status: "cancelada",
      cancelada_em: now,
      cancelamento_motivo: data.motivo,
      cancelada_por: userId,
    } as any).eq("id", data.minuta_id);

    await supabase.from("tms_volumes").update({
      status: "cancelado",
    } as any).eq("minuta_id", data.minuta_id);

    await supabase.from("tms_cancelamentos").insert({
      minuta_id: data.minuta_id,
      escopo: "minuta",
      motivo: data.motivo,
      motivo_texto: data.motivo_texto ?? null,
      usuario_id: userId,
    } as any);

    return { ok: true };
  });
