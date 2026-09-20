import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermissao, auditar, escopoEmpresas, resolveEmpresaId } from "./pxsales-guard";

// PXSales — PORTAL DO CLIENTE (tabela comercial, cotações, entregas e comprovantes).
// Comprovantes/tracking vêm das estruturas reais do PXLog (tms_*): nada é duplicado aqui.
// Tudo o que o cliente enxerga é controlado pelas permissões gravadas no acesso do portal.

export type PortalAcesso = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  token: string;
  ativo: boolean;
  expira_em: string | null;
  ver_tabela: boolean;
  ver_componentes: boolean;
  ver_valores: boolean;
  ver_cotacoes: boolean;
  ver_historico: boolean;
  solicitar_cotacao: boolean;
  ver_entregas: boolean;
  ver_comprovantes: boolean;
  baixar_comprovantes: boolean;
  ver_documentos_fiscais: boolean;
  ultimo_acesso_em: string | null;
  created_at: string;
};

const FLAGS = [
  "ver_tabela",
  "ver_componentes",
  "ver_valores",
  "ver_cotacoes",
  "ver_historico",
  "solicitar_cotacao",
  "ver_entregas",
  "ver_comprovantes",
  "baixar_comprovantes",
  "ver_documentos_fiscais",
] as const;

function novoToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------- ÁREA INTERNA ------------------------------- */

export const listAcessosPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { empresa_id?: string | null; cliente_id?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<PortalAcesso[]> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [];
    let q = sb
      .from("pxsales_portal_acessos")
      .select("*")
      .in("empresa_id", empresas)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.cliente_id) q = q.eq("cliente_id", data.cliente_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PortalAcesso[];
  });

export const salvarAcessoPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.cliente_id && !d?.id) throw new Error("Cliente não informado.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ id: string; token: string }> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");

    const permissoes: Record<string, boolean> = {};
    for (const f of FLAGS) if (data[f] !== undefined) permissoes[f] = !!data[f];

    if (data.id) {
      const payload: Record<string, any> = { ...permissoes, updated_by: userId };
      if (data.ativo !== undefined) payload["ativo"] = !!data.ativo;
      if (data.expira_em !== undefined) payload["expira_em"] = data.expira_em || null;
      if (data.regerar) payload["token"] = novoToken();
      const { data: row, error } = await sb
        .from("pxsales_portal_acessos")
        .update(payload)
        .eq("id", data.id)
        .select("id,token")
        .single();
      if (error) throw new Error(error.message);
      await auditar(sb, userId, "pxsales_portal_acessos", data.id, "atualizado", {
        ...permissoes,
        regerado: !!data.regerar,
      });
      return { id: row.id, token: row.token };
    }

    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id);
    const dias = Math.max(1, Math.min(365, Number(data.dias) || 90));
    const { data: row, error } = await sb
      .from("pxsales_portal_acessos")
      .insert({
        empresa_id: empresaId,
        cliente_id: data.cliente_id,
        token: novoToken(),
        expira_em: new Date(Date.now() + dias * 86400000).toISOString(),
        ...permissoes,
        created_by: userId,
      })
      .select("id,token")
      .single();
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_portal_acessos", row.id, "criado", { cliente_id: data.cliente_id });
    return { id: row.id, token: row.token };
  });

export const revogarAcessoPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Acesso não informado.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");
    const { error } = await sb
      .from("pxsales_portal_acessos")
      .update({ ativo: false, updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_portal_acessos", data.id, "revogado");
    return { ok: true };
  });

/* ------------------------------- ÁREA PÚBLICA ------------------------------- */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function acessoPorToken(sb: any, token: string) {
  const { limitarTentativas } = await import("./pxsales-rate.server");
  await limitarTentativas(sb, "portal_cliente", 60, 600);

  const { data: acesso } = await sb.from("pxsales_portal_acessos").select("*").eq("token", token).maybeSingle();
  if (!acesso || !acesso.ativo) throw new Error("Este acesso não está mais disponível.");
  if (acesso.expira_em && new Date(acesso.expira_em).getTime() < Date.now())
    throw new Error("Este acesso expirou. Solicite um novo link ao time comercial.");
  return acesso;
}

export const getPortalCliente = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || d.token.length < 20 || !/^[a-f0-9]+$/i.test(d.token)) throw new Error("Link inválido.");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const acesso = await acessoPorToken(sb, data.token);
    await sb
      .from("pxsales_portal_acessos")
      .update({ ultimo_acesso_em: new Date().toISOString() })
      .eq("id", acesso.id);

    const { data: cliente } = await sb
      .from("px_registry_clientes")
      .select("id,razao_social,nome_fantasia,cnpj")
      .eq("id", acesso.cliente_id)
      .maybeSingle();

    const permissoes = Object.fromEntries(FLAGS.map((f) => [f, !!acesso[f]])) as Record<string, boolean>;

    /* ------------------------------ tabela comercial ----------------------------- */
    let tabela: any = null;
    if (acesso.ver_tabela) {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: tabelas } = await sb
        .from("pxsales_tabelas")
        .select("*")
        .eq("cliente_id", acesso.cliente_id)
        .eq("empresa_id", acesso.empresa_id)
        .eq("status", "ativa")
        .eq("portal_visivel", true)
        .limit(5);
      for (const t of tabelas ?? []) {
        const { data: v } = await sb
          .from("pxsales_tabela_versoes")
          .select("*")
          .eq("tabela_id", t.id)
          .eq("status", "publicada")
          .lte("vigencia_inicio", hoje)
          .order("versao", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!v) continue;
        if (v.vigencia_fim && v.vigencia_fim < hoje) continue;

        let componentes: any[] = [];
        if (acesso.ver_componentes && t.portal_mostrar_componentes) {
          const { data: comps } = await sb
            .from("pxsales_tabela_componentes")
            .select("id,codigo,nome,tipo,config,ordem")
            .eq("versao_id", v.id)
            .eq("ativo", true)
            .order("ordem", { ascending: true });
          const mostrarValores = acesso.ver_valores && t.portal_mostrar_valores;
          const ids = (comps ?? []).map((c: any) => c.id);
          let faixas: any[] = [];
          if (mostrarValores && ids.length) {
            const { data: fx } = await sb
              .from("pxsales_tabela_faixas")
              .select("componente_id,peso_min,peso_max,tipo_valor,valor,valor_minimo")
              .in("componente_id", ids)
              .order("peso_min", { ascending: true });
            faixas = fx ?? [];
          }
          componentes = (comps ?? []).map((c: any) => ({
            codigo: c.codigo,
            nome: c.nome,
            tipo: c.tipo,
            // valores só aparecem quando o administrador autorizou
            config: mostrarValores ? c.config : null,
            faixas: faixas.filter((f) => f.componente_id === c.id).map(({ componente_id, ...f }) => f),
          }));
        }

        tabela = {
          nome: t.nome,
          tipo: t.tipo,
          versao: v.versao,
          vigencia_inicio: v.vigencia_inicio,
          vigencia_fim: v.vigencia_fim,
          mostra_valores: !!(acesso.ver_valores && t.portal_mostrar_valores),
          componentes,
        };
        break;
      }
    }

    /* --------------------------------- cotações -------------------------------- */
    let cotacoes: any[] = [];
    if (acesso.ver_cotacoes) {
      const { data: rows } = await sb
        .from("pxsales_cotacoes")
        .select(
          "id,numero,created_at,origem_cidade,origem_uf,destino_cidade,destino_uf,tipo_operacao,valor_total,validade_ate,status,prazo_dias,tabela_nome,tabela_versao",
        )
        .eq("cliente_id", acesso.cliente_id)
        .eq("empresa_id", acesso.empresa_id)
        .neq("status", "rascunho")
        .order("created_at", { ascending: false })
        .limit(acesso.ver_historico ? 100 : 10);
      cotacoes = rows ?? [];
    }

    /* ----------------------- operações / comprovantes (PXLog) ---------------------- */
    let operacoes: any[] = [];
    if (acesso.ver_entregas || acesso.ver_comprovantes) {
      const { data: tmsClientes } = await sb
        .from("tms_clientes")
        .select("id")
        .eq("registry_id", acesso.cliente_id);
      const ids = (tmsClientes ?? []).map((c: any) => c.id);
      if (ids.length) {
        const { data: minutas } = await sb
          .from("tms_minutas")
          .select("id,numero,origem,destino,status,created_at,qtd_volumes,peso")
          .in("cliente_id", ids)
          .order("created_at", { ascending: false })
          .limit(50);

        const minutaIds = (minutas ?? []).map((m: any) => m.id);
        let eventos: any[] = [];
        let comprovantes: any[] = [];
        if (minutaIds.length) {
          const { data: ev } = await sb
            .from("tms_eventos")
            .select("minuta_id,tipo,created_at")
            .in("minuta_id", minutaIds)
            .order("created_at", { ascending: true });
          eventos = ev ?? [];

          if (acesso.ver_comprovantes) {
            const { data: entregas } = await sb
              .from("tms_lm_entregas")
              .select("id,minuta_id,status")
              .in("minuta_id", minutaIds);
            const entregaIds = (entregas ?? []).map((e: any) => e.id);
            if (entregaIds.length) {
              const { data: comps } = await sb
                .from("tms_lm_comprovantes")
                .select("id,entrega_id,recebedor_nome,foto_mercadoria,foto_fachada,created_at")
                .in("entrega_id", entregaIds);
              comprovantes = (comps ?? []).map((c: any) => {
                const e = (entregas ?? []).find((x: any) => x.id === c.entrega_id);
                return {
                  id: c.id,
                  minuta_id: e?.minuta_id ?? null,
                  recebedor_nome: c.recebedor_nome,
                  created_at: c.created_at,
                  // o link do arquivo só é entregue quando o download está liberado
                  arquivo: acesso.baixar_comprovantes ? (c.foto_mercadoria ?? c.foto_fachada ?? null) : null,
                  disponivel: !!(c.foto_mercadoria || c.foto_fachada),
                };
              });
            }
          }
        }

        operacoes = (minutas ?? []).map((m: any) => ({
          ...m,
          eventos: acesso.ver_entregas ? eventos.filter((e) => e.minuta_id === m.id) : [],
          comprovantes: comprovantes.filter((c) => c.minuta_id === m.id),
        }));
      }
    }

    return {
      cliente: {
        nome: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
        cnpj: cliente?.cnpj ?? null,
      },
      permissoes,
      tabela,
      cotacoes,
      operacoes,
    };
  });

export const responderCotacaoPortal = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; cotacao_id: string; acao: "aceitar" | "recusar" | "alteracao"; mensagem?: string }) => {
    if (!d?.token || !/^[a-f0-9]{20,}$/i.test(d.token)) throw new Error("Link inválido.");
    if (!d?.cotacao_id) throw new Error("Cotação não informada.");
    if (!["aceitar", "recusar", "alteracao"].includes(d.acao)) throw new Error("Ação inválida.");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const acesso = await acessoPorToken(sb, data.token);
    if (!acesso.ver_cotacoes) throw new Error("Este acesso não permite responder cotações.");

    const { data: cot } = await sb
      .from("pxsales_cotacoes")
      .select("id,status,validade_ate,cliente_id,empresa_id")
      .eq("id", data.cotacao_id)
      .maybeSingle();
    if (!cot || cot.cliente_id !== acesso.cliente_id || cot.empresa_id !== acesso.empresa_id)
      throw new Error("Cotação não encontrada.");
    if (["aprovada", "recusada", "cancelada", "convertida"].includes(cot.status))
      throw new Error("Esta cotação já foi respondida.");
    if (cot.validade_ate && cot.validade_ate < new Date().toISOString().slice(0, 10))
      throw new Error("Esta cotação está expirada. Solicite uma nova ao time comercial.");

    const novo = data.acao === "aceitar" ? "aprovada" : data.acao === "recusar" ? "recusada" : "enviada";
    const { error } = await sb
      .from("pxsales_cotacoes")
      .update({
        status: novo,
        observacoes: data.mensagem
          ? `${data.acao === "alteracao" ? "Alteração solicitada" : "Resposta"} pelo portal: ${String(data.mensagem).slice(0, 500)}`
          : undefined,
      })
      .eq("id", data.cotacao_id)
      .in("status", ["rascunho", "enviada", "visualizada", "em_negociacao"]);
    if (error) throw new Error(error.message);

    await sb.from("px_audit_log").insert({
      entity_type: "pxsales_cotacoes",
      entity_id: data.cotacao_id,
      action: `portal_${data.acao}`,
      diff: { mensagem: data.mensagem ? String(data.mensagem).slice(0, 300) : null },
    });

    return { status: novo };
  });

export const solicitarCotacaoPortal = createServerFn({ method: "POST" })
  .inputValidator((d: any) => {
    if (!d?.token || !/^[a-f0-9]{20,}$/i.test(d.token)) throw new Error("Link inválido.");
    if (!d?.origem || !d?.destino) throw new Error("Informe origem e destino.");
    return d;
  })
  .handler(async ({ data }) => {
    const sb = await admin();
    const acesso = await acessoPorToken(sb, data.token);
    if (!acesso.solicitar_cotacao) throw new Error("Este acesso não permite solicitar cotações.");

    const { data: cliente } = await sb
      .from("px_registry_clientes")
      .select("razao_social,nome_fantasia")
      .eq("id", acesso.cliente_id)
      .maybeSingle();

    const { error } = await sb.from("pxsales_cotacoes").insert({
      empresa_id: acesso.empresa_id,
      cliente_id: acesso.cliente_id,
      empresa_nome: cliente?.nome_fantasia || cliente?.razao_social || "Cliente",
      origem_cidade: String(data.origem).slice(0, 120),
      destino_cidade: String(data.destino).slice(0, 120),
      peso: Number(data.peso) || 0,
      qtd_volumes: Number(data.volumes) || 1,
      valor_mercadoria: Number(data.valor_mercadoria) || 0,
      status: "rascunho",
      observacoes: `Solicitação recebida pelo portal do cliente. ${String(data.observacoes ?? "").slice(0, 400)}`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
