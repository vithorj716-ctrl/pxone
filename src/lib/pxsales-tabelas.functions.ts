import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORDEM_PADRAO,
  calcularTabela,
  validarFaixas,
  type Componente,
  type EntradaCotacao,
  type Faixa,
  type ResultadoCalculo,
} from "@/pxsales/tabela-engine";
import { assertPermissao, auditar, escopoEmpresas, faixa, resolveEmpresaId } from "./pxsales-guard";

// PXSales — TABELAS COMERCIAIS versionadas + motor de cotação com snapshot.
// Reaproveita a arquitetura existente: RBAC (px_has_permission), multiempresa (px_user_empresas),
// auditoria (px_audit_log) e o fluxo cotação → proposta → PXLog já implementado.

export type TabelaComercial = {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  nome: string;
  tipo: string;
  descricao: string | null;
  status: string;
  portal_visivel: boolean;
  portal_mostrar_componentes: boolean;
  portal_mostrar_valores: boolean;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TabelaVersao = {
  id: string;
  tabela_id: string;
  empresa_id: string;
  versao: number;
  status: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ordem_calculo: string[] | null;
  observacoes: string | null;
  publicada_em: string | null;
  created_at: string;
};

const n = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : d;
};
const i = (v: unknown, d = 0) => {
  const x = parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) ? x : d;
};
const hoje = () => new Date().toISOString().slice(0, 10);

function vigente(v: { status: string; vigencia_inicio: string; vigencia_fim: string | null }) {
  const d = hoje();
  return v.status === "publicada" && v.vigencia_inicio <= d && (!v.vigencia_fim || v.vigencia_fim >= d);
}

async function podeAdministrar(sb: any, userId: string) {
  const { data } = await sb.rpc("px_has_permission", {
    _user_id: userId,
    _sistema: "pxsales",
    _acao: "pxsales.tabelas.manage",
  });
  return !!data;
}

/* ================================== TABELAS ================================== */

export const listTabelas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      d:
        | {
            empresa_id?: string | null;
            cliente_id?: string | null;
            status?: string;
            tipo?: string;
            search?: string;
            page?: number;
            pageSize?: number;
          }
        | undefined,
    ) => d ?? {},
  )
  .handler(async ({ data, context }): Promise<TabelaComercial[]> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [];
    const { from, to } = faixa(data.page, data.pageSize);

    let q = sb
      .from("pxsales_tabelas")
      .select("*")
      .in("empresa_id", empresas)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    if (data.status) q = q.eq("status", data.status);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.search) q = q.ilike("nome", `%${data.search.replace(/[%_]/g, "")}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TabelaComercial[];
  });

export const getTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Tabela não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.view");

    const { data: tabela, error } = await sb.from("pxsales_tabelas").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!tabela) throw new Error("Tabela não encontrada.");

    const { data: versoes } = await sb
      .from("pxsales_tabela_versoes")
      .select("*")
      .eq("tabela_id", data.id)
      .order("versao", { ascending: false });

    let cliente: { id: string; razao_social: string | null; nome_fantasia: string | null } | null = null;
    if (tabela.cliente_id) {
      const { data: c } = await sb
        .from("px_registry_clientes")
        .select("id,razao_social,nome_fantasia")
        .eq("id", tabela.cliente_id)
        .maybeSingle();
      cliente = (c ?? null) as any;
    }

    return {
      tabela: tabela as TabelaComercial,
      versoes: (versoes ?? []) as TabelaVersao[],
      cliente,
    };
  });

export const saveTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.nome || !String(d.nome).trim()) throw new Error("Informe o nome da tabela.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, data.id ? "pxsales.tabelas.edit" : "pxsales.tabelas.create");

    const payload: Record<string, any> = {
      nome: String(data.nome).trim(),
      tipo: data.tipo || "cliente",
      cliente_id: data.cliente_id || null,
      descricao: data.descricao || null,
      portal_visivel: !!data.portal_visivel,
      portal_mostrar_componentes: data.portal_mostrar_componentes !== false,
      portal_mostrar_valores: !!data.portal_mostrar_valores,
      responsavel_id: data.responsavel_id || userId,
      updated_by: userId,
    };

    if (data.id) {
      const { error } = await sb.from("pxsales_tabelas").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await auditar(sb, userId, "pxsales_tabelas", data.id, "atualizada", payload);
      return { id: data.id as string };
    }

    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id);
    const { data: row, error } = await sb
      .from("pxsales_tabelas")
      .insert({ ...payload, empresa_id: empresaId, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // primeira versão em rascunho
    const { error: ev } = await sb.from("pxsales_tabela_versoes").insert({
      tabela_id: row.id,
      empresa_id: empresaId,
      versao: 1,
      status: "rascunho",
      vigencia_inicio: data.vigencia_inicio || hoje(),
      vigencia_fim: data.vigencia_fim || null,
      ordem_calculo: ORDEM_PADRAO,
      created_by: userId,
    });
    if (ev) throw new Error(ev.message);

    await auditar(sb, userId, "pxsales_tabelas", row.id, "criada", payload);
    return { id: row.id as string };
  });

export const setStatusTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "ativa" | "inativa" | "arquivada" }) => {
    if (!d?.id || !["ativa", "inativa", "arquivada"].includes(d.status)) throw new Error("Dados incompletos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, data.status === "arquivada" ? "pxsales.tabelas.manage" : "pxsales.tabelas.edit");
    const { error } = await sb
      .from("pxsales_tabelas")
      .update({ status: data.status, updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_tabelas", data.id, "status", { para: data.status });
    return { ok: true };
  });

export const duplicarTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; nome?: string; cliente_id?: string | null }) => {
    if (!d?.id) throw new Error("Tabela não informada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.create");

    const { data: origem } = await sb.from("pxsales_tabelas").select("*").eq("id", data.id).maybeSingle();
    if (!origem) throw new Error("Tabela não encontrada.");

    const { data: nova, error } = await sb
      .from("pxsales_tabelas")
      .insert({
        empresa_id: origem.empresa_id,
        cliente_id: data.cliente_id === undefined ? origem.cliente_id : data.cliente_id,
        nome: (data.nome || `${origem.nome} (cópia)`).trim(),
        tipo: origem.tipo,
        descricao: origem.descricao,
        status: "ativa",
        portal_visivel: false,
        portal_mostrar_componentes: origem.portal_mostrar_componentes,
        portal_mostrar_valores: origem.portal_mostrar_valores,
        responsavel_id: userId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: ultima } = await sb
      .from("pxsales_tabela_versoes")
      .select("*")
      .eq("tabela_id", data.id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: v, error: ev } = await sb
      .from("pxsales_tabela_versoes")
      .insert({
        tabela_id: nova.id,
        empresa_id: origem.empresa_id,
        versao: 1,
        status: "rascunho",
        vigencia_inicio: hoje(),
        ordem_calculo: ultima?.ordem_calculo ?? ORDEM_PADRAO,
        created_by: userId,
      })
      .select("id")
      .single();
    if (ev) throw new Error(ev.message);

    if (ultima) {
      const { data: comps } = await sb.from("pxsales_tabela_componentes").select("*").eq("versao_id", ultima.id);
      for (const c of comps ?? []) {
        const { data: novoC } = await sb
          .from("pxsales_tabela_componentes")
          .insert({
            versao_id: v.id,
            empresa_id: origem.empresa_id,
            codigo: c.codigo,
            tipo: c.tipo,
            nome: c.nome,
            ativo: c.ativo,
            ordem: c.ordem,
            config: c.config,
          })
          .select("id")
          .single();
        const { data: faixas } = await sb.from("pxsales_tabela_faixas").select("*").eq("componente_id", c.id);
        if (novoC && faixas?.length) {
          await sb.from("pxsales_tabela_faixas").insert(
            faixas.map((f: any) => ({
              componente_id: novoC.id,
              empresa_id: origem.empresa_id,
              peso_min: f.peso_min,
              peso_max: f.peso_max,
              tipo_valor: f.tipo_valor,
              valor: f.valor,
              valor_minimo: f.valor_minimo,
            })),
          );
        }
      }
    }

    await auditar(sb, userId, "pxsales_tabelas", nova.id, "duplicada", { origem: data.id });
    return { id: nova.id as string };
  });

/* ================================== VERSÕES ================================== */

export const getVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Versão não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.view");

    const { data: versao, error } = await sb
      .from("pxsales_tabela_versoes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!versao) throw new Error("Versão não encontrada.");

    const { data: comps } = await sb
      .from("pxsales_tabela_componentes")
      .select("*")
      .eq("versao_id", data.id)
      .order("ordem", { ascending: true });

    const ids = (comps ?? []).map((c: any) => c.id);
    let faixas: any[] = [];
    if (ids.length) {
      const { data: fx } = await sb
        .from("pxsales_tabela_faixas")
        .select("*")
        .in("componente_id", ids)
        .order("peso_min", { ascending: true });
      faixas = fx ?? [];
    }

    const componentes: Componente[] = (comps ?? []).map((c: any) => ({
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      nome: c.nome,
      ativo: c.ativo,
      ordem: c.ordem,
      config: c.config ?? {},
      faixas: faixas
        .filter((f) => f.componente_id === c.id)
        .map((f) => ({
          id: f.id,
          peso_min: Number(f.peso_min),
          peso_max: Number(f.peso_max),
          tipo_valor: f.tipo_valor,
          valor: Number(f.valor),
          valor_minimo: Number(f.valor_minimo),
        })),
    }));

    return { versao: versao as TabelaVersao, componentes, vigente: vigente(versao) };
  });

export const saveVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.id) throw new Error("Versão não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.edit");

    const { data: atual } = await sb
      .from("pxsales_tabela_versoes")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (!atual) throw new Error("Versão não encontrada.");
    if (atual.status === "publicada" && !(await podeAdministrar(sb, userId)))
      throw new Error("Versão publicada: crie uma nova versão para alterar as regras.");

    const payload: Record<string, any> = { updated_by: userId };
    if (data.vigencia_inicio) payload["vigencia_inicio"] = data.vigencia_inicio;
    if (data.vigencia_fim !== undefined) payload["vigencia_fim"] = data.vigencia_fim || null;
    if (data.observacoes !== undefined) payload["observacoes"] = data.observacoes || null;
    if (Array.isArray(data.ordem_calculo)) payload["ordem_calculo"] = data.ordem_calculo;
    if (data.status && ["rascunho", "inativa", "arquivada"].includes(data.status)) payload["status"] = data.status;

    const { error } = await sb.from("pxsales_tabela_versoes").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_tabela_versoes", data.id, "atualizada", payload);
    return { ok: true };
  });

/** Grava o conjunto de componentes da versão (construtor). Versão publicada é imutável. */
export const salvarComponentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versao_id: string; componentes: Componente[] }) => {
    if (!d?.versao_id) throw new Error("Versão não informada.");
    if (!Array.isArray(d.componentes)) throw new Error("Componentes inválidos.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.edit");

    const { data: versao } = await sb
      .from("pxsales_tabela_versoes")
      .select("id,status,empresa_id")
      .eq("id", data.versao_id)
      .maybeSingle();
    if (!versao) throw new Error("Versão não encontrada.");
    if (versao.status === "publicada")
      throw new Error("Versão publicada não pode ser alterada. Crie uma nova versão.");

    for (const c of data.componentes) {
      if (c.faixas?.length) {
        const erros = validarFaixas(c.faixas as Faixa[]);
        if (erros.length) throw new Error(`${c.nome}: ${erros[0]}`);
      }
    }

    const { error: del } = await sb.from("pxsales_tabela_componentes").delete().eq("versao_id", data.versao_id);
    if (del) throw new Error(del.message);

    let ordem = 0;
    for (const c of data.componentes) {
      const { data: novo, error } = await sb
        .from("pxsales_tabela_componentes")
        .insert({
          versao_id: data.versao_id,
          empresa_id: versao.empresa_id,
          codigo: String(c.codigo),
          tipo: String(c.tipo),
          nome: String(c.nome ?? c.codigo),
          ativo: c.ativo !== false,
          ordem: c.ordem ?? ordem++,
          config: c.config ?? {},
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (c.faixas?.length) {
        const { error: ef } = await sb.from("pxsales_tabela_faixas").insert(
          c.faixas.map((f) => ({
            componente_id: novo.id,
            empresa_id: versao.empresa_id,
            peso_min: n(f.peso_min),
            peso_max: n(f.peso_max),
            tipo_valor: f.tipo_valor ?? "fixo",
            valor: n(f.valor),
            valor_minimo: n(f.valor_minimo),
          })),
        );
        if (ef) throw new Error(ef.message);
      }
    }

    await auditar(sb, userId, "pxsales_tabela_versoes", data.versao_id, "componentes", {
      total: data.componentes.length,
    });
    return { ok: true };
  });

export const publicarVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { versao_id: string }) => {
    if (!d?.versao_id) throw new Error("Versão não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.publish");
    const { error } = await sb.rpc("pxsales_publicar_versao", { _versao_id: data.versao_id });
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_tabela_versoes", data.versao_id, "publicada");
    return { ok: true };
  });

export const novaVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tabela_id: string; vigencia_inicio?: string; vigencia_fim?: string | null }) => {
    if (!d?.tabela_id) throw new Error("Tabela não informada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.tabelas.create");
    const { data: id, error } = await sb.rpc("pxsales_nova_versao", {
      _tabela_id: data.tabela_id,
      _vigencia_inicio: data.vigencia_inicio ?? hoje(),
      _vigencia_fim: data.vigencia_fim ?? null,
    });
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_tabelas", data.tabela_id, "nova_versao", { versao_id: id });
    return { id: id as string };
  });

/* =============================== MOTOR / COTAÇÃO ============================= */

async function carregarVersao(sb: any, versaoId: string) {
  const { data: versao } = await sb.from("pxsales_tabela_versoes").select("*").eq("id", versaoId).maybeSingle();
  if (!versao) throw new Error("Versão da tabela não encontrada.");
  const { data: tabela } = await sb.from("pxsales_tabelas").select("*").eq("id", versao.tabela_id).maybeSingle();
  const { data: comps } = await sb
    .from("pxsales_tabela_componentes")
    .select("*")
    .eq("versao_id", versaoId)
    .order("ordem", { ascending: true });
  const ids = (comps ?? []).map((c: any) => c.id);
  let faixas: any[] = [];
  if (ids.length) {
    const { data: fx } = await sb.from("pxsales_tabela_faixas").select("*").in("componente_id", ids);
    faixas = fx ?? [];
  }
  const componentes: Componente[] = (comps ?? []).map((c: any) => ({
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    nome: c.nome,
    ativo: c.ativo,
    ordem: c.ordem,
    config: c.config ?? {},
    faixas: faixas
      .filter((f) => f.componente_id === c.id)
      .map((f) => ({
        peso_min: Number(f.peso_min),
        peso_max: Number(f.peso_max),
        tipo_valor: f.tipo_valor,
        valor: Number(f.valor),
        valor_minimo: Number(f.valor_minimo),
      })),
  }));
  return { versao, tabela, componentes };
}

const entradaDe = (d: any): EntradaCotacao => ({
  peso: n(d.peso),
  cubagem: n(d.cubagem),
  qtd_volumes: i(d.qtd_volumes, 1),
  valor_mercadoria: n(d.valor_mercadoria),
  eixos: i(d.eixos, 0),
  horas_espera: n(d.horas_espera),
  diarias: n(d.diarias),
  desconto_percentual: n(d.desconto_percentual),
  reentrega: !!d.reentrega,
  devolucao: !!d.devolucao,
  area_risco: !!d.area_risco,
  dificuldade: !!d.dificuldade,
});

/** Prévia oficial: o cálculo roda no servidor, com a versão real da tabela. */
export const calcularCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.versao_id) throw new Error("Selecione a versão da tabela.");
    return d;
  })
  .handler(async ({ data, context }): Promise<ResultadoCalculo & { tabela_nome: string; versao: number }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.cotacoes.view");
    const { versao, tabela, componentes } = await carregarVersao(sb, data.versao_id);
    const res = calcularTabela(
      { id: versao.id, versao: versao.versao, ordem_calculo: versao.ordem_calculo, componentes },
      entradaDe(data),
    );
    return { ...res, tabela_nome: tabela?.nome ?? "—", versao: versao.versao };
  });

/** Salva a cotação congelando tabela, versão, componentes e valores (snapshot). */
export const salvarCotacaoComTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.versao_id) throw new Error("Selecione a versão da tabela.");
    if (!d?.empresa_nome || !String(d.empresa_nome).trim()) throw new Error("Informe o cliente/empresa da cotação.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string; total: number }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.cotacoes.create");

    const { versao, tabela, componentes } = await carregarVersao(sb, data.versao_id);
    if (!tabela) throw new Error("Tabela comercial não encontrada.");

    const admin = await podeAdministrar(sb, userId);
    if (tabela.status !== "ativa" && !admin) throw new Error("Esta tabela não está ativa para novas cotações.");
    if (!vigente(versao) && !admin)
      throw new Error("Esta versão não está vigente. Selecione a versão publicada e vigente.");
    if (tabela.cliente_id && data.cliente_id && tabela.cliente_id !== data.cliente_id && !admin)
      throw new Error("Esta tabela pertence a outro cliente.");

    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id ?? tabela.empresa_id);
    if (tabela.empresa_id !== empresaId) throw new Error("Tabela de outra empresa do grupo.");

    const entrada = entradaDe(data);
    const calc = calcularTabela(
      { id: versao.id, versao: versao.versao, ordem_calculo: versao.ordem_calculo, componentes },
      entrada,
    );

    const snapshot = {
      gerado_em: new Date().toISOString(),
      tabela: { id: tabela.id, nome: tabela.nome, tipo: tabela.tipo },
      versao: {
        id: versao.id,
        versao: versao.versao,
        vigencia_inicio: versao.vigencia_inicio,
        vigencia_fim: versao.vigencia_fim,
        ordem_calculo: versao.ordem_calculo,
      },
      componentes: componentes.map((c) => ({
        codigo: c.codigo,
        tipo: c.tipo,
        nome: c.nome,
        ativo: c.ativo,
        config: c.config,
        faixas: c.faixas ?? [],
      })),
      entrada,
      resultado: calc,
    };

    const linha = (codigo: string) => calc.linhas.find((l) => l.codigo === codigo)?.valor ?? 0;
    const taxasExtras = calc.linhas
      .filter((l) => l.codigo.startsWith("taxa_") && !["taxa_coleta", "taxa_entrega"].includes(l.codigo))
      .reduce((s, l) => s + l.valor, 0);

    const { data: row, error } = await sb
      .from("pxsales_cotacoes")
      .insert({
        empresa_id: empresaId,
        cliente_id: data.cliente_id || tabela.cliente_id || null,
        oportunidade_id: data.oportunidade_id || null,
        lead_id: data.lead_id || null,
        empresa_nome: String(data.empresa_nome).trim(),
        contato_nome: data.contato_nome || null,
        contato_email: data.contato_email || null,
        contato_telefone: data.contato_telefone || null,
        origem_cidade: data.origem_cidade || null,
        origem_uf: data.origem_uf || null,
        origem_cep: data.origem_cep || null,
        destino_cidade: data.destino_cidade || null,
        destino_uf: data.destino_uf || null,
        destino_cep: data.destino_cep || null,
        tipo_operacao: data.tipo_operacao || "transferencia",
        tabela_id: tabela.id,
        tabela_versao_id: versao.id,
        tabela_nome: tabela.nome,
        tabela_versao: versao.versao,
        qtd_volumes: entrada.qtd_volumes,
        peso: entrada.peso,
        cubagem: entrada.cubagem,
        peso_cubado: calc.peso_cubado,
        peso_taxado: calc.peso_taxado,
        valor_mercadoria: entrada.valor_mercadoria,
        tipo_mercadoria: data.tipo_mercadoria || null,
        prazo_dias: i(data.prazo_dias, 1),
        valor_base: linha("frete_base") + linha("faixa_peso") + linha("excedente_peso"),
        valor_coleta: linha("taxa_coleta"),
        valor_entrega: linha("taxa_entrega"),
        pedagio: linha("pedagio"),
        gris_percentual: n(data.gris_percentual),
        advalorem_percentual: n(data.advalorem_percentual),
        taxas_extras: taxasExtras,
        desconto_percentual: n(data.desconto_percentual),
        subtotal: calc.subtotal,
        desconto_valor: calc.desconto,
        valor_total: calc.total,
        snapshot,
        condicao_pagamento: data.condicao_pagamento || null,
        validade_ate: data.validade_ate || null,
        status: "rascunho",
        observacoes: data.observacoes || null,
        responsavel_id: userId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (calc.linhas.length) {
      await sb.from("pxsales_cotacao_componentes").insert(
        calc.linhas.map((l, idx) => ({
          cotacao_id: row.id,
          empresa_id: empresaId,
          ordem: idx,
          codigo: l.codigo,
          nome: l.nome,
          base: l.base,
          valor: l.valor,
          detalhe: l.detalhe,
        })),
      );
    }

    await auditar(sb, userId, "pxsales_cotacoes", row.id, "criada_com_tabela", {
      tabela_id: tabela.id,
      versao: versao.versao,
      total: calc.total,
    });

    return { id: row.id as string, total: calc.total };
  });

/** Detalhamento congelado de uma cotação. */
export const getDetalhamentoCotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cotacao_id: string }) => {
    if (!d?.cotacao_id) throw new Error("Cotação não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.cotacoes.view");
    const { data: rows, error } = await sb
      .from("pxsales_cotacao_componentes")
      .select("*")
      .eq("cotacao_id", data.cotacao_id)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

/** Versões disponíveis para cotar um cliente (tabelas do cliente + balcão/geral). */
export const listVersoesDisponiveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id?: string | null; empresa_id?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.cotacoes.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [] as any[];

    let q = sb.from("pxsales_tabelas").select("*").in("empresa_id", empresas).eq("status", "ativa");
    if (data.cliente_id) q = q.or(`cliente_id.eq.${data.cliente_id},cliente_id.is.null`);
    else q = q.is("cliente_id", null);
    const { data: tabelas, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    if (!tabelas?.length) return [] as any[];

    const { data: versoes } = await sb
      .from("pxsales_tabela_versoes")
      .select("*")
      .in(
        "tabela_id",
        tabelas.map((t: any) => t.id),
      )
      .eq("status", "publicada")
      .order("versao", { ascending: false });

    const d = hoje();
    return (versoes ?? [])
      .filter((v: any) => v.vigencia_inicio <= d && (!v.vigencia_fim || v.vigencia_fim >= d))
      .map((v: any) => {
        const t = tabelas.find((x: any) => x.id === v.tabela_id);
        return {
          versao_id: v.id,
          tabela_id: v.tabela_id,
          tabela_nome: t?.nome ?? "—",
          tipo: t?.tipo ?? "cliente",
          cliente_id: t?.cliente_id ?? null,
          versao: v.versao,
          vigencia_inicio: v.vigencia_inicio,
          vigencia_fim: v.vigencia_fim,
        };
      });
  });
