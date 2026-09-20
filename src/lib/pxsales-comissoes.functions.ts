import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// PXSales — Etapa 7: comissões configuráveis por vigência, com histórico congelado na apuração.

export type ComissaoRegra = {
  id: string;
  nome: string;
  base: string;
  tipo: string;
  percentual: number;
  valor_fixo: number;
  responsavel_id: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
};

export type Comissao = {
  id: string;
  proposta_id: string | null;
  cliente_id: string | null;
  empresa_nome: string;
  responsavel_id: string | null;
  regra_id: string | null;
  regra_snapshot: Record<string, string | number | boolean | null>;
  base_valor: number;
  percentual: number;
  valor: number;
  competencia: string;
  status: string;
  observacoes: string | null;
  congelada_em: string;
  created_at: string;
};

export const STATUS_COMISSAO = [
  { value: "prevista", label: "Prevista" },
  { value: "aprovada", label: "Aprovada" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

const n = (v: unknown, def = 0) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : def;
};

/* ---------------------------------- REGRAS --------------------------------- */

export const listComissaoRegras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ComissaoRegra[]> => {
    const sb = (context as any).supabase as any;
    const { data, error } = await sb
      .from("pxsales_comissao_regras")
      .select("*")
      .order("ativo", { ascending: false })
      .order("vigencia_inicio", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ComissaoRegra[];
  });

export const saveComissaoRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<ComissaoRegra> & { id?: string }) => {
    if (!d?.nome?.trim()) throw new Error("Informe o nome da regra.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    const payload = {
      nome: data.nome!.trim(),
      base: data.base ?? "proposta",
      tipo: data.tipo ?? "percentual",
      percentual: n(data.percentual),
      valor_fixo: n(data.valor_fixo),
      responsavel_id: data.responsavel_id || null,
      vigencia_inicio: data.vigencia_inicio || new Date().toISOString().slice(0, 10),
      vigencia_fim: data.vigencia_fim || null,
      ativo: data.ativo ?? true,
      observacoes: data.observacoes ?? null,
      updated_by: userId,
    };
    if (data.id) {
      const { error } = await sb.from("pxsales_comissao_regras").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("pxsales_comissao_regras")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirComissaoRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Regra não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase as any;
    const { error } = await sb.from("pxsales_comissao_regras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- COMISSÕES -------------------------------- */

export const listComissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; responsavel_id?: string; competencia?: string; meus?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<Comissao[]> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    let q = sb.from("pxsales_comissoes").select("*").order("competencia", { ascending: false }).limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.responsavel_id) q = q.eq("responsavel_id", data.responsavel_id);
    if (data.meus) q = q.eq("responsavel_id", userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Comissao[];
  });

/** Escolhe a regra vigente para o vendedor na data e congela os valores apurados. */
export const apurarComissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<{ criadas: number; ignoradas: number }> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;

    let q = sb
      .from("pxsales_propostas")
      .select("id,cliente_id,empresa_nome,valor_total,responsavel_id,aceita_em,status")
      .eq("status", "aceita")
      .limit(400);
    if (data.proposta_id) q = q.eq("id", data.proposta_id);
    const { data: propostas, error } = await q;
    if (error) throw new Error(error.message);

    const { data: regras } = await sb.from("pxsales_comissao_regras").select("*").eq("ativo", true);
    const { data: existentes } = await sb.from("pxsales_comissoes").select("proposta_id");
    const jaTem = new Set((existentes ?? []).map((r: any) => r.proposta_id));

    let criadas = 0;
    let ignoradas = 0;

    for (const p of propostas ?? []) {
      if (jaTem.has(p.id)) { ignoradas++; continue; }
      const dataBase = (p.aceita_em ?? new Date().toISOString()).slice(0, 10);
      const candidatas = (regras ?? []).filter(
        (r: any) =>
          r.vigencia_inicio <= dataBase &&
          (!r.vigencia_fim || r.vigencia_fim >= dataBase) &&
          (!r.responsavel_id || r.responsavel_id === p.responsavel_id),
      );
      // Regra específica do vendedor tem prioridade sobre a regra geral.
      const regra =
        candidatas.find((r: any) => r.responsavel_id === p.responsavel_id) ?? candidatas[0] ?? null;
      if (!regra) { ignoradas++; continue; }

      const base = n(p.valor_total);
      const valor = regra.tipo === "fixo" ? n(regra.valor_fixo) : (base * n(regra.percentual)) / 100;

      const { error: e2 } = await sb.from("pxsales_comissoes").insert({
        proposta_id: p.id,
        cliente_id: p.cliente_id,
        empresa_nome: p.empresa_nome,
        responsavel_id: p.responsavel_id,
        regra_id: regra.id,
        regra_snapshot: regra,
        base_valor: base,
        percentual: regra.tipo === "fixo" ? 0 : n(regra.percentual),
        valor,
        competencia: dataBase,
        status: "prevista",
        created_by: userId,
      });
      if (e2) throw new Error(e2.message);
      criadas++;
    }

    return { criadas, ignoradas };
  });

export const setStatusComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => {
    if (!d?.id || !d?.status) throw new Error("Dados incompletos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase as any;
    const { error } = await sb
      .from("pxsales_comissoes")
      .update({ status: data.status, updated_by: (context as any).userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
