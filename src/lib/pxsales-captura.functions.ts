// PXSales — CAPTURA RÁPIDA DE LEAD (visita comercial no celular).
// Não existe cadastro paralelo: grava em pxsales_leads e registra a visita
// em pxsales_atividades, reutilizando permissões, empresa e responsável atuais.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onlyDigits } from "./cnpj";
import { assertPermissao, escopoEmpresas, resolveEmpresaId } from "./pxsales-guard";

export type CapturaEntrada = {
  captura_key: string;
  empresa: string;
  cnpj?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
  contato_cargo?: string | null;
  cidade?: string | null;
  uf?: string | null;
  segmento?: string | null;
  tipo_carga?: string | null;
  potencial_mensal?: number | string | null;
  temperatura?: string | null;
  observacoes?: string | null;
  proxima_acao?: string | null;
  proxima_acao_em?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capturado_em?: string | null;
  empresa_id?: string | null;
};

export type CapturaResultado = {
  id: string;
  situacao: "criado" | "atualizado" | "duplicado";
  empresa: string;
};

const txt = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || null;
};
const numOuNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const chaveNome = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const capturarLeadRapido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CapturaEntrada) => {
    if (!d?.captura_key) throw new Error("Captura sem identificador.");
    if (!txt(d?.empresa)) throw new Error("Informe o nome da empresa visitada.");
    return d;
  })
  .handler(async ({ data, context }): Promise<CapturaResultado> => {
    const sb = (context as any).supabase;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.leads.create");

    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id ?? null);
    const escopo = await escopoEmpresas(sb, userId, empresaId);
    const nome = txt(data.empresa)!;
    const cnpj = data.cnpj ? onlyDigits(String(data.cnpj)) || null : null;
    const quando = data.capturado_em ?? new Date().toISOString();

    // 1) idempotência: o mesmo envio offline não cria dois leads
    const jaGravado = await sb
      .from("pxsales_leads")
      .select("id, empresa")
      .eq("empresa_id", empresaId)
      .eq("captura_key", data.captura_key)
      .maybeSingle();
    if (jaGravado.data?.id) {
      return { id: jaGravado.data.id as string, situacao: "duplicado", empresa: jaGravado.data.empresa as string };
    }

    // 2) deduplicação: mesmo CNPJ, ou mesmo nome dentro do escopo do vendedor
    let existente: { id: string; empresa: string; observacoes: string | null } | null = null;
    if (cnpj) {
      const r = await sb
        .from("pxsales_leads")
        .select("id, empresa, observacoes")
        .in("empresa_id", escopo.length ? escopo : [empresaId])
        .eq("cnpj", cnpj)
        .limit(1)
        .maybeSingle();
      existente = r.data ?? null;
    }
    if (!existente) {
      const r = await sb
        .from("pxsales_leads")
        .select("id, empresa, observacoes")
        .in("empresa_id", escopo.length ? escopo : [empresaId])
        .ilike("empresa", nome)
        .limit(1)
        .maybeSingle();
      if (r.data && chaveNome(r.data.empresa) === chaveNome(nome)) existente = r.data;
    }

    const campos: Record<string, any> = {
      cnpj,
      nome_fantasia: txt(data.contato_nome) ? null : null,
      cidade: txt(data.cidade),
      uf: txt(data.uf)?.toUpperCase() ?? null,
      segmento: txt(data.segmento),
      tipo_carga: txt(data.tipo_carga),
      contato_nome: txt(data.contato_nome),
      contato_cargo: txt(data.contato_cargo),
      contato_telefone: txt(data.contato_telefone),
      contato_email: txt(data.contato_email),
      potencial_mensal: numOuNull(data.potencial_mensal),
      temperatura: txt(data.temperatura) ?? "morno",
      proxima_acao: txt(data.proxima_acao),
      proxima_acao_em: txt(data.proxima_acao_em),
      latitude: numOuNull(data.latitude),
      longitude: numOuNull(data.longitude),
    };

    let leadId: string;
    let situacao: CapturaResultado["situacao"];

    if (existente) {
      // não sobrescreve o que já existe: só preenche lacunas
      const atual = await sb.from("pxsales_leads").select("*").eq("id", existente.id).single();
      const patch: Record<string, any> = { updated_by: userId, captura_key: data.captura_key };
      for (const [k, v] of Object.entries(campos)) {
        if (v === null || v === undefined) continue;
        if (k === "temperatura") continue;
        if (atual.data?.[k] === null || atual.data?.[k] === undefined || atual.data?.[k] === "") patch[k] = v;
      }
      const obs = txt(data.observacoes);
      if (obs) {
        patch["observacoes"] = [atual.data?.observacoes, `[visita ${new Date(quando).toLocaleString("pt-BR")}] ${obs}`]
          .filter(Boolean)
          .join("\n");
      }
      const { error } = await sb.from("pxsales_leads").update(patch).eq("id", existente.id);
      if (error) throw new Error(error.message);
      leadId = existente.id;
      situacao = "atualizado";
    } else {
      const { data: ins, error } = await sb
        .from("pxsales_leads")
        .insert({
          ...campos,
          empresa: nome,
          origem: "visita",
          etapa: "novo_lead",
          status: "aberto",
          observacoes: txt(data.observacoes),
          empresa_id: empresaId,
          captura_key: data.captura_key,
          responsavel_id: userId,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) {
        // corrida entre dois envios simultâneos do mesmo aparelho
        const retry = await sb
          .from("pxsales_leads")
          .select("id, empresa")
          .eq("empresa_id", empresaId)
          .eq("captura_key", data.captura_key)
          .maybeSingle();
        if (retry.data?.id) return { id: retry.data.id as string, situacao: "duplicado", empresa: nome };
        throw new Error(error.message);
      }
      leadId = ins.id as string;
      situacao = "criado";
    }

    // 3) a visita vira atividade concluída no histórico comercial
    const partes = [
      txt(data.observacoes),
      txt(data.contato_nome) ? `Contato: ${txt(data.contato_nome)}${txt(data.contato_cargo) ? ` (${txt(data.contato_cargo)})` : ""}` : null,
      txt(data.contato_telefone) ? `Telefone: ${txt(data.contato_telefone)}` : null,
      numOuNull(data.latitude) !== null ? `Local: ${data.latitude}, ${data.longitude}` : null,
    ].filter(Boolean);

    await sb.from("pxsales_atividades").insert({
      tipo: "visita",
      assunto: `Visita — ${nome}`,
      descricao: partes.join(" · ") || null,
      lead_id: leadId,
      empresa_id: empresaId,
      responsavel_id: userId,
      concluida: true,
      concluida_em: quando,
      resultado: situacao === "criado" ? "Lead criado na visita" : "Visita registrada no lead existente",
      created_by: userId,
      updated_by: userId,
    });

    if (txt(data.proxima_acao)) {
      await sb.from("pxsales_atividades").insert({
        tipo: "followup",
        assunto: txt(data.proxima_acao),
        lead_id: leadId,
        empresa_id: empresaId,
        responsavel_id: userId,
        prevista_para: txt(data.proxima_acao_em),
        concluida: false,
        created_by: userId,
        updated_by: userId,
      });
    }

    return { id: leadId, situacao, empresa: nome };
  });
