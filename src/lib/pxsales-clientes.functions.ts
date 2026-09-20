import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onlyDigits } from "./cnpj";
import { assertPermissao, auditar, faixa } from "./pxsales-guard";
import { PXSALES_SISTEMA_KEY } from "@/pxsales/pxsales.permissions";

/** Dados financeiros do cliente só aparecem para quem tem a permissão específica. */
async function podeVerFinanceiro(sb: any, userId: string): Promise<boolean> {
  const { data } = await sb.rpc("px_has_permission", {
    _user_id: userId,
    _sistema: PXSALES_SISTEMA_KEY,
    _acao: "pxsales.clientes.financeiro.view",
  });
  return !!data;
}

// PXSales — leitura comercial sobre o cadastro único (PX Registry) e a operação real (PXLog).
// Nenhuma base paralela de clientes é criada aqui.

export type SalesClienteRow = {
  id: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cidade: string | null;
  uf: string | null;
  categorias: string[];
  situacao_cadastral: string | null;
  ativo: boolean;
  telefone: string | null;
  email: string | null;
  limite_credito: number | null;
  condicao_pagamento: string | null;
  vinculado_pxsales: boolean;
  contatos: number;
  enderecos: number;
  minutas: number;
  ultima_minuta: string | null;
  faturamento_30d: number;
};

export const listSalesClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      d:
        | {
            search?: string;
            categoria?: string;
            situacao?: "todos" | "ativos" | "inativos";
            apenasCarteira?: boolean;
            page?: number;
            pageSize?: number;
          }
        | undefined,
    ) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.view");
    const financeiro = await podeVerFinanceiro(sb, userId);
    const { from, to } = faixa((data as any).page, (data as any).pageSize ?? 200);

    let q = sb
      .from("px_registry_clientes")
      .select(
        "id,cnpj,razao_social,nome_fantasia,cidade,uf,categorias,situacao_cadastral,ativo,telefone,email,limite_credito,condicao_pagamento",
      )
      .order("razao_social", { ascending: true })
      .limit(400);

    if (data.categoria) q = q.contains("categorias", [data.categoria]);
    if (data.situacao === "ativos") q = q.eq("ativo", true);
    if (data.situacao === "inativos") q = q.eq("ativo", false);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(
        `razao_social.ilike.%${s}%,nome_fantasia.ilike.%${s}%,cnpj.ilike.%${onlyDigits(s) || s}%,cidade.ilike.%${s}%`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const clientes = (rows ?? []) as any[];
    if (!clientes.length) return [] as SalesClienteRow[];

    const ids = clientes.map((c) => c.id);

    const [vinc, contatos, enderecos, tms] = await Promise.all([
      sb.from("px_registry_vinculos").select("cliente_id").eq("sistema_key", "pxsales").in("cliente_id", ids),
      sb.from("px_registry_contatos").select("cliente_id").in("cliente_id", ids),
      sb.from("px_registry_enderecos").select("cliente_id").in("cliente_id", ids).eq("ativo", true),
      sb.from("tms_clientes").select("id,registry_id").in("registry_id", ids),
    ]);

    const vincSet = new Set((vinc.data ?? []).map((v: any) => v.cliente_id));
    const countBy = (arr: any[] | null) => {
      const m = new Map<string, number>();
      for (const r of arr ?? []) m.set(r.cliente_id, (m.get(r.cliente_id) ?? 0) + 1);
      return m;
    };
    const cContatos = countBy(contatos.data);
    const cEnderecos = countBy(enderecos.data);

    const tmsRows = (tms.data ?? []) as any[];
    const tmsToRegistry = new Map<string, string>(tmsRows.map((t) => [t.id, t.registry_id]));

    const minutasPorRegistry = new Map<string, { qtd: number; ultima: string | null; valor30: number }>();
    if (tmsRows.length) {
      const { data: minutas } = await sb
        .from("tms_minutas")
        .select("cliente_id,created_at,valor_frete")
        .in("cliente_id", Array.from(tmsToRegistry.keys()))
        .order("created_at", { ascending: false })
        .limit(2000);
      const limite30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const m of (minutas ?? []) as any[]) {
        const reg = tmsToRegistry.get(m.cliente_id);
        if (!reg) continue;
        const cur = minutasPorRegistry.get(reg) ?? { qtd: 0, ultima: null, valor30: 0 };
        cur.qtd += 1;
        if (!cur.ultima || m.created_at > cur.ultima) cur.ultima = m.created_at;
        if (new Date(m.created_at).getTime() >= limite30) cur.valor30 += Number(m.valor_frete ?? 0);
        minutasPorRegistry.set(reg, cur);
      }
    }

    return clientes.map((c): SalesClienteRow => {
      const op = minutasPorRegistry.get(c.id);
      return {
        id: c.id,
        cnpj: c.cnpj,
        razao_social: c.razao_social ?? null,
        nome_fantasia: c.nome_fantasia ?? null,
        cidade: c.cidade ?? null,
        uf: c.uf ?? null,
        categorias: (c.categorias ?? []) as string[],
        situacao_cadastral: c.situacao_cadastral ?? null,
        ativo: c.ativo !== false,
        telefone: c.telefone ?? null,
        email: c.email ?? null,
        limite_credito: financeiro ? c.limite_credito ?? null : null,
        condicao_pagamento: c.condicao_pagamento ?? null,
        vinculado_pxsales: vincSet.has(c.id),
        contatos: cContatos.get(c.id) ?? 0,
        enderecos: cEnderecos.get(c.id) ?? 0,
        minutas: op?.qtd ?? 0,
        ultima_minuta: op?.ultima ?? null,
        faturamento_30d: financeiro ? op?.valor30 ?? 0 : 0,
      };
    });
  });

export const getSalesCliente360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.view");
    const financeiro = await podeVerFinanceiro(sb, userId);

    const { data: cliente, error } = await sb
      .from("px_registry_clientes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) throw new Error("Cliente não encontrado");

    const [contatos, enderecos, credito, saldo, lancamentos, vinculos, historico, tmsCli] = await Promise.all([
      sb
        .from("px_registry_contatos")
        .select("*")
        .eq("cliente_id", data.id)
        .order("is_principal", { ascending: false })
        .order("created_at", { ascending: true }),
      sb.from("px_registry_enderecos").select("*").eq("cliente_id", data.id).order("created_at", { ascending: true }),
      sb.from("px_cliente_credito").select("*").eq("cliente_id", data.id).maybeSingle(),
      sb.from("px_cliente_saldo").select("*").eq("cliente_id", data.id).maybeSingle(),
      sb
        .from("px_cliente_lancamentos")
        .select("*")
        .eq("cliente_id", data.id)
        .order("vencimento", { ascending: true })
        .limit(30),
      sb.from("px_registry_vinculos").select("sistema_key,vinculado_em").eq("cliente_id", data.id),
      sb
        .from("px_audit_log")
        .select("*")
        .eq("entity_type", "px_registry_clientes")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      sb.from("tms_clientes").select("id").eq("registry_id", data.id).maybeSingle(),
    ]);

    let minutas: any[] = [];
    let tabelas: any[] = [];
    if (tmsCli.data?.id) {
      const [mn, tb] = await Promise.all([
        sb
          .from("tms_minutas")
          .select("id,numero,origem,destino,status,status_financeiro,valor_frete,qtd_volumes,created_at")
          .eq("cliente_id", tmsCli.data.id)
          .order("created_at", { ascending: false })
          .limit(25),
        sb
          .from("tms_tabela_frete")
          .select("id,nome,origem,destino,tipo_cobranca,valor_minimo,prazo_dias,ativo")
          .eq("cliente_id", tmsCli.data.id)
          .order("nome", { ascending: true }),
      ]);
      minutas = mn.data ?? [];
      tabelas = tb.data ?? [];
    }

    const valorTotal = minutas.reduce((s, m) => s + Number(m.valor_frete ?? 0), 0);

    return {
      cliente,
      contatos: contatos.data ?? [],
      enderecos: enderecos.data ?? [],
      credito: financeiro ? credito.data ?? null : null,
      saldo: financeiro ? saldo.data ?? null : null,
      lancamentos: financeiro ? lancamentos.data ?? [] : [],
      financeiro_visivel: financeiro,
      vinculos: vinculos.data ?? [],
      historico: historico.data ?? [],
      minutas,
      tabelas,
      resumo: {
        minutas: minutas.length,
        valor_total: valorTotal,
        ticket_medio: minutas.length ? valorTotal / minutas.length : 0,
        ultima_minuta: minutas[0]?.created_at ?? null,
      },
    };
  });

export const listSalesContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; setor?: string; page?: number; pageSize?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertPermissao(sb, (context as any).userId, "pxsales.clientes.view");

    let q = sb
      .from("px_registry_contatos")
      .select("*")
      .order("is_principal", { ascending: false })
      .order("nome", { ascending: true })
      .limit(500);
    if (data.setor) q = q.eq("setor", data.setor);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`nome.ilike.%${s}%,email.ilike.%${s}%,cargo.ilike.%${s}%,telefone.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const contatos = (rows ?? []) as any[];
    if (!contatos.length) return [];

    const ids = Array.from(new Set(contatos.map((c) => c.cliente_id)));
    const { data: clientes } = await sb
      .from("px_registry_clientes")
      .select("id,razao_social,nome_fantasia,cnpj,ativo")
      .in("id", ids);
    const map = new Map((clientes ?? []).map((c: any) => [c.id, c]));

    return contatos.map((c) => ({ ...c, cliente: map.get(c.cliente_id) ?? null }));
  });

export const vincularClientePxSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; vincular: boolean }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;
    await assertPermissao(sb, userId, "pxsales.clientes.edit");
    if (data.vincular) {
      await sb
        .from("px_registry_vinculos")
        .upsert(
          { cliente_id: data.cliente_id, sistema_key: "pxsales", vinculado_por: userId },
          { onConflict: "cliente_id,sistema_key", ignoreDuplicates: true },
        );
    } else {
      await sb.from("px_registry_vinculos").delete().eq("cliente_id", data.cliente_id).eq("sistema_key", "pxsales");
    }
    return { ok: true };
  });
