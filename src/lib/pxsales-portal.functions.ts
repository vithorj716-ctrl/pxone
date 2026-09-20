import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermissao, auditar, escopoEmpresas, faixa } from "./pxsales-guard";

// PXSales — portal público da proposta (link com código aleatório, aceite/recusa/pedido de alteração).
// A resposta do cliente acontece em uma única transação no banco (RPC), sem risco de duplo aceite.

export type PortalEvento = {
  id: string;
  proposta_id: string;
  tipo: string;
  mensagem: string | null;
  created_at: string;
};

export type PropostaPublica = {
  numero: number;
  titulo: string;
  empresa_nome: string;
  escopo: string | null;
  condicoes: string | null;
  condicao_pagamento: string | null;
  validade_ate: string | null;
  valor_total: number;
  status: string;
  expirada: boolean;
  respondida: boolean;
  cotacao: {
    origem: string;
    destino: string;
    tipo_operacao: string;
    prazo_dias: number;
    qtd_volumes: number;
    peso: number;
    peso_taxado: number;
  } | null;
};

function novoToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------ ÁREA INTERNA ------------------------------ */

export const gerarLinkPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id: string; dias?: number; regerar?: boolean }) => {
    if (!d?.proposta_id) throw new Error("Proposta não informada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ token: string; expira_em: string }> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");

    const { data: p, error } = await sb
      .from("pxsales_propostas")
      .select("id,portal_token,portal_expira_em,empresa_id")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Proposta não encontrada.");

    const dias = Math.max(1, Math.min(90, data.dias ?? 15));
    const expira = new Date(Date.now() + dias * 86400000).toISOString();
    const token = !data.regerar && p.portal_token ? (p.portal_token as string) : novoToken();

    const { error: e2 } = await sb
      .from("pxsales_propostas")
      .update({ portal_token: token, portal_expira_em: expira, portal_ativo: true, updated_by: userId })
      .eq("id", data.proposta_id);
    if (e2) throw new Error(e2.message);

    await auditar(sb, userId, "pxsales_propostas", data.proposta_id, "portal_link", {
      regerado: !!data.regerar,
      expira_em: expira,
    });

    return { token, expira_em: expira };
  });

export const revogarLinkPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id: string }) => {
    if (!d?.proposta_id) throw new Error("Proposta não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");

    const { error } = await sb
      .from("pxsales_propostas")
      .update({ portal_ativo: false, updated_by: userId })
      .eq("id", data.proposta_id);
    if (error) throw new Error(error.message);
    await auditar(sb, userId, "pxsales_propostas", data.proposta_id, "portal_revogado");
    return { ok: true };
  });

export const listPortalEventos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposta_id?: string; page?: number; pageSize?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<PortalEvento[]> => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");
    const { from, to } = faixa(data.page, data.pageSize);

    let q = sb.from("pxsales_portal_eventos").select("*").order("created_at", { ascending: false }).range(from, to);
    if (data.proposta_id) q = q.eq("proposta_id", data.proposta_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PortalEvento[];
  });

/** Lista das propostas com link ativo/gerado, para a tela do Portal do Cliente. */
export const listLinksPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { empresa_id?: string | null; page?: number; pageSize?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase as any;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.portal.manage");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id);
    if (!empresas.length) return [] as any[];
    const { from, to } = faixa(data.page, data.pageSize);

    const { data: rows, error } = await sb
      .from("pxsales_propostas")
      .select(
        "id,numero,empresa_nome,titulo,valor_total,status,portal_token,portal_expira_em,portal_aberta_em,portal_ativo,created_at",
      )
      .in("empresa_id", empresas)
      .not("portal_token", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

/* ------------------------------ ÁREA PÚBLICA ------------------------------ */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Leitura pública da proposta pelo código do link. Só expõe o que o cliente precisa ver. */
export const getPropostaPublica = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || d.token.length < 20 || !/^[a-f0-9]+$/i.test(d.token)) throw new Error("Link inválido.");
    return d;
  })
  .handler(async ({ data }): Promise<PropostaPublica> => {
    const sb = await admin();
    const { limitarTentativas } = await import("./pxsales-rate.server");
    await limitarTentativas(sb, "portal_leitura", 40, 600);

    const { data: p } = await sb
      .from("pxsales_propostas")
      .select("*")
      .eq("portal_token", data.token)
      .maybeSingle();
    if (!p || p.portal_ativo === false) throw new Error("Este link não está mais disponível.");

    const expirada = !!p.portal_expira_em && new Date(p.portal_expira_em).getTime() < Date.now();

    const agora = new Date().toISOString();
    if (!p.portal_aberta_em) {
      await sb.from("pxsales_propostas").update({ portal_aberta_em: agora }).eq("id", p.id);
    }
    if (!expirada && ["rascunho", "enviada"].includes(p.status)) {
      await sb.from("pxsales_propostas").update({ status: "visualizada", visualizada_em: agora }).eq("id", p.id);
    }
    await sb.from("pxsales_portal_eventos").insert({ proposta_id: p.id, tipo: "abertura" });

    let cot: PropostaPublica["cotacao"] = null;
    if (p.cotacao_id) {
      const { data: c } = await sb.from("pxsales_cotacoes").select("*").eq("id", p.cotacao_id).maybeSingle();
      if (c) {
        cot = {
          origem: `${c.origem_cidade ?? "—"}/${c.origem_uf ?? "—"}`,
          destino: `${c.destino_cidade ?? "—"}/${c.destino_uf ?? "—"}`,
          tipo_operacao: c.tipo_operacao,
          prazo_dias: Number(c.prazo_dias ?? 0),
          qtd_volumes: Number(c.qtd_volumes ?? 0),
          peso: Number(c.peso ?? 0),
          peso_taxado: Number(c.peso_taxado ?? 0),
        };
      }
    }

    return {
      numero: Number(p.numero),
      titulo: p.titulo,
      empresa_nome: p.empresa_nome,
      escopo: p.escopo,
      condicoes: p.condicoes,
      condicao_pagamento: p.condicao_pagamento,
      validade_ate: p.validade_ate,
      valor_total: Number(p.valor_total ?? 0),
      status: p.status,
      expirada,
      respondida: ["aceita", "recusada"].includes(p.status),
      cotacao: cot,
    };
  });

/** Resposta do cliente no portal: aceitar, recusar ou pedir alteração — transação única no banco. */
export const responderPropostaPublica = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; acao: "aceitar" | "recusar" | "alteracao"; mensagem?: string; nome?: string }) => {
    if (!d?.token || d.token.length < 20 || !/^[a-f0-9]+$/i.test(d.token)) throw new Error("Link inválido.");
    if (!["aceitar", "recusar", "alteracao"].includes(d?.acao)) throw new Error("Ação inválida.");
    return d;
  })
  .handler(async ({ data }): Promise<{ status: string }> => {
    const sb = await admin();
    const { limitarTentativas } = await import("./pxsales-rate.server");
    await limitarTentativas(sb, "portal_resposta", 15, 600);

    const { data: res, error } = await sb.rpc("pxsales_responder_proposta_publica", {
      p_token: data.token,
      p_acao: data.acao,
      p_mensagem: data.mensagem ?? null,
      p_nome: data.nome ?? null,
    });
    if (error) throw new Error(error.message);
    return { status: (res as any)?.status as string };
  });
