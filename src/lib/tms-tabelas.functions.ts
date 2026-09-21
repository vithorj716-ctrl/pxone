// Tabelas comerciais de frete — camada server (protegida).
// Estrutura: tms_tabela_frete (cabeçalho, campos legados preservados)
//            + tms_tabela_regras (regras comerciais estruturadas)
//            + tms_servicos / tms_rotas (entidades reutilizáveis).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RegraComercial } from "@/pxlog/regra-engine";
import { parseDecimal } from "@/pxlog/num";

const MODOS = ["valor_fixo", "percentual", "por_kg", "por_m3", "por_km", "por_volume", "faixa", "minimo"];
const BASES = ["nenhuma", "valor_nota", "valor_frete", "subtotal", "peso", "peso_taxado", "cubagem", "volumes", "distancia"];

const txt = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);

function normalizarRegra(d: any, tabela_id: string) {
  const modo = String(d?.modo ?? "");
  if (!MODOS.includes(modo)) throw new Error("Modo de cobrança inválido.");
  const base = String(d?.base_calculo ?? "nenhuma");
  if (!BASES.includes(base)) throw new Error("Base de cálculo inválida.");
  if (!txt(d?.nome)) throw new Error("Informe o nome da regra.");
  const valor = parseDecimal(d?.valor);
  if (modo === "percentual" && base === "nenhuma") throw new Error("Percentual exige uma base de cálculo.");
  if (modo !== "faixa" && valor === null) throw new Error("Informe o valor da regra.");
  return {
    tabela_id,
    nome: txt(d?.nome)!,
    tipo: String(d?.tipo ?? "taxa"),
    modo,
    valor,
    unidade: txt(d?.unidade),
    base_calculo: base,
    servico_id: txt(d?.servico_id),
    rota_id: txt(d?.rota_id),
    faixa_campo: txt(d?.faixa_campo),
    faixa_min: parseDecimal(d?.faixa_min),
    faixa_max: parseDecimal(d?.faixa_max),
    valor_minimo: parseDecimal(d?.valor_minimo),
    valor_maximo: parseDecimal(d?.valor_maximo),
    ordem: Number.isFinite(Number(d?.ordem)) ? Number(d?.ordem) : 100,
    ativo: d?.ativo !== false,
    config: d?.config ?? {},
  };
}

export const listTabelasFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id?: string | null; apenasAtivas?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("tms_tabela_frete").select("*").order("nome");
    if (data.apenasAtivas) q = q.eq("ativo", true);
    if (data.cliente_id) q = q.or(`cliente_id.eq.${data.cliente_id},cliente_id.is.null`);
    const [tabs, regras, servicos, rotas] = await Promise.all([
      q,
      sb.from("tms_tabela_regras").select("*").order("ordem"),
      sb.from("tms_servicos").select("*").order("nome"),
      sb.from("tms_rotas").select("*").order("nome"),
    ]);
    if (tabs.error) throw new Error(tabs.error.message);
    const porTabela = new Map<string, any[]>();
    for (const r of regras.data ?? []) {
      const arr = porTabela.get(r.tabela_id) ?? [];
      arr.push(r);
      porTabela.set(r.tabela_id, arr);
    }
    return {
      tabelas: (tabs.data ?? []).map((t: any) => ({ ...t, regras: porTabela.get(t.id) ?? [] })),
      servicos: servicos.data ?? [],
      rotas: rotas.data ?? [],
    };
  });

export const saveTabelaFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.nome?.trim()) throw new Error("Informe o nome da tabela.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = {
      nome: data.nome.trim(),
      cliente_id: txt(data.cliente_id),
      origem: txt(data.origem),
      destino: txt(data.destino),
      tipo_cobranca: String(data.tipo_cobranca ?? "peso"),
      prazo_dias: Number(parseDecimal(data.prazo_dias) ?? 1),
      faixa_peso_min: parseDecimal(data.faixa_peso_min),
      faixa_peso_max: parseDecimal(data.faixa_peso_max),
      ativo: data.ativo !== false,
      regra: data.regra ?? {},
    };
    if (data.id) {
      const { error } = await sb.from("tms_tabela_frete").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    }
    const { data: row, error } = await sb.from("tms_tabela_frete").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteTabelaFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Tabela não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("tms_tabela_frete").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveRegraTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.tabela_id) throw new Error("Tabela não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = normalizarRegra(data, data.tabela_id);
    if (data.id) {
      const { error } = await sb.from("tms_tabela_regras").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    }
    const { data: row, error } = await sb.from("tms_tabela_regras").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteRegraTabela = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Regra não informada.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("tms_tabela_regras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.nome?.trim()) throw new Error("Informe o nome do serviço.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const codigo = (txt(data.codigo) ?? data.nome)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const payload = {
      codigo,
      nome: data.nome.trim(),
      descricao: txt(data.descricao),
      unidade: txt(data.unidade) ?? "un",
      ativo: data.ativo !== false,
    };
    if (data.id) {
      const { error } = await sb.from("tms_servicos").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    }
    const existente = await sb.from("tms_servicos").select("id").ilike("codigo", codigo).maybeSingle();
    if (existente.data?.id) return { id: existente.data.id as string, reutilizado: true };
    const { data: row, error } = await sb.from("tms_servicos").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const saveRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => {
    if (!d?.nome?.trim() && !(d?.origem_cidade && d?.destino_cidade)) throw new Error("Informe o nome ou origem/destino da rota.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const nome =
      txt(data.nome) ??
      `${txt(data.origem_cidade)}/${txt(data.origem_uf) ?? ""} → ${txt(data.destino_cidade)}/${txt(data.destino_uf) ?? ""}`;
    const codigo = (txt(data.codigo) ?? nome)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const payload = {
      codigo,
      nome,
      origem_cidade: txt(data.origem_cidade),
      origem_uf: txt(data.origem_uf)?.toUpperCase() ?? null,
      destino_cidade: txt(data.destino_cidade),
      destino_uf: txt(data.destino_uf)?.toUpperCase() ?? null,
      distancia_km: parseDecimal(data.distancia_km),
      ativo: data.ativo !== false,
    };
    if (data.id) {
      const { error } = await sb.from("tms_rotas").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    }
    const existente = await sb.from("tms_rotas").select("id").ilike("codigo", codigo).maybeSingle();
    if (existente.data?.id) return { id: existente.data.id as string, reutilizado: true };
    const { data: row, error } = await sb.from("tms_rotas").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Grava as tabelas/regras vindas do importador, reutilizando cabeçalhos com o mesmo nome. */
export const importarTabelasFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      tabelas: {
        nome: string;
        cliente_id?: string | null;
        origem?: string | null;
        destino?: string | null;
        rota_id?: string | null;
        prazo_dias?: number | null;
        regras: RegraComercial[];
      }[];
      substituirRegras?: boolean;
    }) => {
      if (!Array.isArray(d?.tabelas) || !d.tabelas.length) throw new Error("Nada para importar.");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let criadas = 0;
    let atualizadas = 0;
    let regrasGravadas = 0;

    for (const t of data.tabelas) {
      let tabelaId: string | null = null;
      const existente = await sb
        .from("tms_tabela_frete")
        .select("id")
        .eq("nome", t.nome)
        .maybeSingle();
      if (existente.data?.id) {
        tabelaId = existente.data.id;
        await sb
          .from("tms_tabela_frete")
          .update({
            cliente_id: t.cliente_id ?? null,
            origem: t.origem ?? null,
            destino: t.destino ?? null,
            prazo_dias: t.prazo_dias ?? 1,
          })
          .eq("id", tabelaId);
        atualizadas++;
        if (data.substituirRegras) await sb.from("tms_tabela_regras").delete().eq("tabela_id", tabelaId);
      } else {
        const { data: row, error } = await sb
          .from("tms_tabela_frete")
          .insert({
            nome: t.nome,
            cliente_id: t.cliente_id ?? null,
            origem: t.origem ?? null,
            destino: t.destino ?? null,
            prazo_dias: t.prazo_dias ?? 1,
            tipo_cobranca: "peso",
            ativo: true,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        tabelaId = row.id;
        criadas++;
      }

      const payload = t.regras.map((r, i) =>
        normalizarRegra({ ...r, rota_id: r.rota_id ?? t.rota_id ?? null, ordem: r.ordem ?? (i + 1) * 10 }, tabelaId!),
      );
      if (payload.length) {
        const { error } = await sb.from("tms_tabela_regras").insert(payload);
        if (error) throw new Error(error.message);
        regrasGravadas += payload.length;
      }
    }

    return { criadas, atualizadas, regras: regrasGravadas };
  });
