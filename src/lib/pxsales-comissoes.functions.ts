import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermissao, escopoEmpresas, faixa, resolveEmpresaId } from "./pxsales-guard";

// PXSales — comissões configuráveis por vigência, apuradas de forma atômica no banco
// (RPC pxsales_apurar_comissao / pxsales_set_status_comissao) com histórico congelado e estorno auditável.

export type ComissaoRegra = {
  id: string;
  empresa_id: string;
  nome: string;
  base: string;
  tipo: string;
  percentual: number;
  valor_fixo: number;
  responsavel_id: string | null;
  cliente_id: string | null;
  tipo_operacao: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
};

export type Comissao = {
  id: string;
  empresa_id: string;
  proposta_id: string | null;
  cliente_id: string | null;
  empresa_nome: string;
  responsavel_id: string | null;
  regra_id: string | null;
  regra_nome: string | null;
  regra_snapshot: Record<string, string | number | boolean | null>;
  base: string;
  base_valor: number;
  percentual: number;
  valor_fixo: number;
  valor: number;
  competencia: string;
  status: string;
  observacoes: string | null;
  congelada_em: string;
  apurada_em: string;
  estornada_em: string | null;
  estorno_motivo: string | null;
  comissao_origem_id: string | null;
  created_at: string;
};

export const STATUS_COMISSAO = [
  { value: "prevista", label: "Prevista" },
  { value: "aprovada", label: "Aprovada" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
  { value: "estornada", label: "Estornada" },
];

/** Transições permitidas — espelham a validação feita no banco. */
export const TRANSICOES_COMISSAO: Record<string, string[]> = {
  prevista: ["aprovada", "cancelada"],
  aprovada: ["paga", "cancelada"],
  paga: ["estornada"],
  cancelada: [],
  estornada: [],
};

export const BASES_COMISSAO = [
  { value: "proposta", label: "Valor da proposta" },
  { value: "faturamento", label: "Faturamento da operação (PXLog)" },
];

const n = (v: unknown, def = 0) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : def;
};

/* ---------------------------------- REGRAS --------------------------------- */

export const listComissaoRegras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { empresa_id?: string | null; page?: number; pageSize?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<ComissaoRegra[]> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [];
    const { from, to } = faixa(data.page, data.pageSize);

    const { data: rows, error } = await sb
      .from("pxsales_comissao_regras")
      .select("*")
      .in("empresa_id", empresas)
      .order("ativo", { ascending: false })
      .order("vigencia_inicio", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ComissaoRegra[];
  });

export const saveComissaoRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<ComissaoRegra> & { id?: string; empresa_id?: string | null }) => {
    if (!d?.nome?.trim()) throw new Error("Informe o nome da regra.");
    if (d.base && !["proposta", "faturamento"].includes(d.base))
      throw new Error("Base de cálculo inválida.");
    if (d.tipo && !["percentual", "fixo"].includes(d.tipo)) throw new Error("Tipo de regra inválido.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.manage");
    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id);

    const payload = {
      empresa_id: empresaId,
      nome: data.nome!.trim(),
      base: data.base ?? "proposta",
      tipo: data.tipo ?? "percentual",
      percentual: n(data.percentual),
      valor_fixo: n(data.valor_fixo),
      responsavel_id: data.responsavel_id || null,
      cliente_id: data.cliente_id || null,
      tipo_operacao: data.tipo_operacao || null,
      vigencia_inicio: data.vigencia_inicio || new Date().toISOString().slice(0, 10),
      vigencia_fim: data.vigencia_fim || null,
      ativo: data.ativo ?? true,
      observacoes: data.observacoes ?? null,
      updated_by: userId,
    };

    const traduz = (msg: string) =>
      msg.includes("pxsales_regra_sem_sobreposicao")
        ? "Já existe uma regra ativa com o mesmo alcance nesse período. Encerre a vigência da regra anterior antes de criar outra."
        : msg;

    if (data.id) {
      const { error } = await sb.from("pxsales_comissao_regras").update(payload).eq("id", data.id);
      if (error) throw new Error(traduz(error.message));
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("pxsales_comissao_regras")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(traduz(error.message));
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
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.manage");

    // Regra já usada em apuração nunca é apagada — apenas encerrada, preservando o histórico.
    const { count } = await sb
      .from("pxsales_comissoes")
      .select("id", { count: "exact", head: true })
      .eq("regra_id", data.id);
    if ((count ?? 0) > 0) {
      const { error } = await sb
        .from("pxsales_comissao_regras")
        .update({ ativo: false, vigencia_fim: new Date().toISOString().slice(0, 10), updated_by: userId })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, encerrada: true };
    }
    const { error } = await sb.from("pxsales_comissao_regras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, encerrada: false };
  });

/* -------------------------------- COMISSÕES -------------------------------- */

export const listComissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      d:
        | {
            status?: string;
            responsavel_id?: string;
            competencia?: string;
            meus?: boolean;
            empresa_id?: string | null;
            page?: number;
            pageSize?: number;
          }
        | undefined,
    ) => d ?? {},
  )
  .handler(async ({ data, context }): Promise<Comissao[]> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [];
    const { from, to } = faixa(data.page, data.pageSize);

    let q = sb
      .from("pxsales_comissoes")
      .select("*")
      .in("empresa_id", empresas)
      .order("competencia", { ascending: false })
      .range(from, to);
    if (data.status) q = q.eq("status", data.status);
    if (data.responsavel_id) q = q.eq("responsavel_id", data.responsavel_id);
    if (data.meus) q = q.eq("responsavel_id", userId);
    if (data.competencia) q = q.eq("competencia", data.competencia);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Comissao[];
  });

/**
 * Apuração feita no banco (RPC), uma proposta por vez e dentro de uma única transação:
 * escolhe a regra mais específica vigente, congela o snapshot e impede duplicidade.
 */
export const apurarComissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id?: string; empresa_id?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<{ criadas: number; ignoradas: number; erros: string[] }> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.manage");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return { criadas: 0, ignoradas: 0, erros: [] };

    let q = sb
      .from("pxsales_propostas")
      .select("id")
      .eq("status", "aceita")
      .in("empresa_id", empresas)
      .order("aceita_em", { ascending: false })
      .limit(200);
    if (data.proposta_id) q = q.eq("id", data.proposta_id);
    const { data: propostas, error } = await q;
    if (error) throw new Error(error.message);

    let criadas = 0;
    let ignoradas = 0;
    const erros: string[] = [];

    for (const p of (propostas ?? []) as any[]) {
      const { data: res, error: e } = await sb.rpc("pxsales_apurar_comissao", { p_proposta_id: p.id });
      if (e) {
        ignoradas++;
        if (erros.length < 5) erros.push(e.message);
        continue;
      }
      if ((res as any)?.ja_existia) ignoradas++;
      else criadas++;
    }

    return { criadas, ignoradas, erros };
  });

/** Mudança de status validada no banco; estorno gera lançamento espelho auditável. */
export const setStatusComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string; motivo?: string }) => {
    if (!d?.id || !d?.status) throw new Error("Dados incompletos.");
    if (!STATUS_COMISSAO.some((s) => s.value === d.status)) throw new Error("Status inválido.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.comissoes.manage");

    const { data: res, error } = await sb.rpc("pxsales_set_status_comissao", {
      p_id: data.id,
      p_status: data.status,
      p_motivo: data.motivo ?? null,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status: string; estorno_id: string | null };
  });
