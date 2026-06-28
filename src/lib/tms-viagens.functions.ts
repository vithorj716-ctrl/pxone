import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOTIVOS_CANCEL = [
  "solicitacao_duplicada",
  "cliente_desistiu",
  "erro_cadastro",
  "mercadoria_nao_enviada",
  "carga_recusada",
  "problema_operacional",
  "outros",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCEL)[number];

// Cria viagem + vincula minutas + recalcula totais previstos.
export const iniciarEmbarque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    origem: string;
    destino: string;
    rota?: string | null;
    motorista_id?: string | null;
    motorista_nome?: string | null;
    veiculo_id?: string | null;
    placa?: string | null;
    data_prevista?: string | null;
    minuta_ids: string[];
    viagem_id?: string | null;
    observacoes?: string | null;
  }) => {
    if (!d?.origem || !d?.destino) throw new Error("Origem e destino obrigatórios");
    if (!Array.isArray(d.minuta_ids) || d.minuta_ids.length === 0) throw new Error("Selecione ao menos 1 minuta");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Totais previstos a partir das minutas (apenas não canceladas)
    const { data: minutas, error: mErr } = await supabase
      .from("tms_minutas")
      .select("id, qtd_volumes, peso_taxado, cubagem, cancelada_em")
      .in("id", data.minuta_ids);
    if (mErr) throw new Error(mErr.message);
    const ativas = (minutas ?? []).filter((m: any) => !m.cancelada_em);
    if (ativas.length === 0) throw new Error("Todas as minutas selecionadas estão canceladas");

    const totalVol = ativas.reduce((a: number, m: any) => a + Number(m.qtd_volumes || 0), 0);
    const totalPeso = ativas.reduce((a: number, m: any) => a + Number(m.peso_taxado || 0), 0);
    const totalCub = ativas.reduce((a: number, m: any) => a + Number(m.cubagem || 0), 0);

    let viagemId = data.viagem_id ?? null;

    if (!viagemId) {
      // gera código tipo "GOI-00021"
      const { data: seq } = await supabase.rpc("nextval" as any, { sequence_name: "tms_viagem_seq" } as any).single() as any;
      let codigo: string;
      if (seq && typeof seq === "number") {
        codigo = `${data.origem.slice(0, 3).toUpperCase()}-${String(seq).padStart(5, "0")}`;
      } else {
        // fallback: count + 1
        const { count } = await supabase.from("tms_viagens").select("id", { count: "exact", head: true });
        codigo = `${data.origem.slice(0, 3).toUpperCase()}-${String((count ?? 0) + 1).padStart(5, "0")}`;
      }

      const { data: nova, error: vErr } = await supabase
        .from("tms_viagens")
        .insert({
          codigo,
          origem: data.origem,
          destino: data.destino,
          rota: data.rota,
          motorista_id: data.motorista_id,
          motorista_nome: data.motorista_nome,
          veiculo_id: data.veiculo_id,
          placa: data.placa,
          status: "em_embarque",
          data_prevista: data.data_prevista,
          iniciada_em: new Date().toISOString(),
          operador_id: userId,
          qtd_volumes_prev: totalVol,
          peso_prev: totalPeso,
          cubagem_prev: totalCub,
          observacoes: data.observacoes,
        } as any)
        .select()
        .single();
      if (vErr) throw new Error(vErr.message);
      viagemId = (nova as any).id;
    } else {
      await supabase.from("tms_viagens").update({
        status: "em_embarque",
        iniciada_em: new Date().toISOString(),
        operador_id: userId,
        qtd_volumes_prev: totalVol,
        peso_prev: totalPeso,
        cubagem_prev: totalCub,
      } as any).eq("id", viagemId);
    }

    // vincular minutas (ignora duplicadas)
    const links = ativas.map((m: any) => ({ viagem_id: viagemId, minuta_id: m.id }));
    await supabase.from("tms_viagem_minutas").upsert(links as any, { onConflict: "viagem_id,minuta_id" } as any);

    await supabase.from("tms_viagem_eventos").insert({
      viagem_id: viagemId,
      tipo: "iniciada",
      operador_id: userId,
      payload: { minutas: ativas.length, volumes: totalVol },
    } as any);

    return { viagem_id: viagemId };
  });

// Bipa um volume durante o embarque, com todas as validações.
export const bipVolumeEmbarque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { viagem_id: string; codigo: string }) => {
    if (!d?.viagem_id || !d?.codigo) throw new Error("viagem_id e codigo obrigatórios");
    return { viagem_id: d.viagem_id, codigo: d.codigo.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    async function logErr(motivo: string, volume_id: string | null = null) {
      await supabase.from("tms_viagem_eventos").insert({
        viagem_id: data.viagem_id, volume_id, codigo: data.codigo,
        tipo: "bip_erro", motivo, operador_id: userId,
      } as any);
      return { ok: false, motivo };
    }

    // viagem
    const { data: viagem } = await supabase.from("tms_viagens").select("*").eq("id", data.viagem_id).maybeSingle();
    if (!viagem) return logErr("Viagem não encontrada");
    if ((viagem as any).status === "finalizada") return logErr("Viagem já finalizada");
    if ((viagem as any).status === "cancelada") return logErr("Viagem cancelada");

    // volume
    const { data: vol } = await supabase
      .from("tms_volumes")
      .select("*, tms_minutas(id, numero, status, cancelada_em, destino, qtd_volumes, tms_clientes(nome))")
      .eq("codigo", data.codigo)
      .maybeSingle() as any;
    if (!vol) return logErr("Código não encontrado");

    const minuta = vol.tms_minutas;
    if (!minuta) return logErr("Volume sem minuta vinculada", vol.id);
    if (minuta.cancelada_em) return logErr(`Minuta #${minuta.numero} cancelada`, vol.id);

    // pertence à viagem (via vínculo minuta)?
    const { data: link } = await supabase
      .from("tms_viagem_minutas")
      .select("viagem_id")
      .eq("viagem_id", data.viagem_id)
      .eq("minuta_id", minuta.id)
      .maybeSingle();
    if (!link) return logErr(`Minuta #${minuta.numero} não faz parte desta viagem`, vol.id);

    if (vol.bloqueado) return logErr(`Volume bloqueado: ${vol.bloqueio_motivo ?? "sem motivo"}`, vol.id);
    if (vol.status === "cancelado") return logErr("Volume cancelado", vol.id);
    if (vol.status === "entregue") return logErr("Volume já entregue", vol.id);
    if (vol.status === "embarcado" || vol.viagem_id) return logErr("Volume já embarcado", vol.id);

    if (vol.hub_atual && (viagem as any).origem && vol.hub_atual !== (viagem as any).origem && vol.hub_atual !== "origem") {
      // tolerante: aceita "origem" genérico, mas barra se hub explícito for outro
      return logErr(`Volume está no HUB ${vol.hub_atual}, viagem sai de ${(viagem as any).origem}`, vol.id);
    }

    // tudo ok — embarca e conferencia ao mesmo tempo
    await supabase.from("tms_volumes").update({
      status: "embarcado",
      hub_atual: "transito",
      viagem_id: data.viagem_id,
      embarcado_em: new Date().toISOString(),
      embarcado_por: userId,
    } as any).eq("id", vol.id);

    await supabase.from("tms_eventos").insert([
      { minuta_id: minuta.id, volume_id: vol.id, tipo: "conferido", origem_evento: "embarque", operador_id: userId, payload: { viagem: (viagem as any).codigo } } as any,
      { minuta_id: minuta.id, volume_id: vol.id, tipo: "embarcado", origem_evento: "embarque", operador_id: userId, payload: { viagem: (viagem as any).codigo } } as any,
    ]);

    await supabase.from("tms_viagem_eventos").insert({
      viagem_id: data.viagem_id, volume_id: vol.id, codigo: data.codigo,
      tipo: "bip_ok", operador_id: userId,
      payload: { minuta: minuta.numero, cliente: minuta.tms_clientes?.nome, peso: vol.peso },
    } as any);

    // atualiza contadores
    await supabase.rpc("nextval" as any, {} as any).then(() => null).catch(() => null); // noop
    const { data: emb } = await supabase
      .from("tms_volumes")
      .select("peso")
      .eq("viagem_id", data.viagem_id);
    const qtd = emb?.length ?? 0;
    const peso = (emb ?? []).reduce((a: number, v: any) => a + Number(v.peso || 0), 0);
    await supabase.from("tms_viagens").update({ qtd_volumes_emb: qtd, peso_emb: peso } as any).eq("id", data.viagem_id);

    return {
      ok: true,
      volume: { id: vol.id, numero: vol.numero, peso: vol.peso },
      minuta: { numero: minuta.numero, cliente: minuta.tms_clientes?.nome, destino: minuta.destino },
    };
  });

export const finalizarEmbarque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { viagem_id: string; forcar?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: viagem } = await supabase.from("tms_viagens").select("*").eq("id", data.viagem_id).maybeSingle() as any;
    if (!viagem) throw new Error("Viagem não encontrada");

    // volumes pendentes
    const { data: pendentes } = await supabase
      .from("tms_volumes")
      .select("id, codigo, numero, minuta_id, tms_minutas!inner(numero, tms_viagem_minutas!inner(viagem_id))")
      .neq("status", "embarcado")
      .neq("status", "cancelado")
      .eq("tms_minutas.tms_viagem_minutas.viagem_id", data.viagem_id) as any;

    const pend = pendentes ?? [];
    if (pend.length > 0 && !data.forcar) {
      return { ok: false, pendentes: pend.length };
    }

    // registra pendentes como ocorrência
    for (const p of pend) {
      await supabase.from("tms_cancelamentos").insert({
        viagem_id: data.viagem_id, volume_id: p.id, minuta_id: p.minuta_id,
        escopo: "volume", motivo: "ficou_no_hub", usuario_id: userId,
      } as any);
      await supabase.from("tms_viagem_eventos").insert({
        viagem_id: data.viagem_id, volume_id: p.id, codigo: p.codigo,
        tipo: "volume_pendente", operador_id: userId, motivo: "ficou_no_hub",
      } as any);
    }

    const fim = new Date();
    const ini = viagem.iniciada_em ? new Date(viagem.iniciada_em) : fim;
    const tempo = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 60000));

    const resumo = {
      previstos: viagem.qtd_volumes_prev,
      embarcados: viagem.qtd_volumes_emb,
      faltantes: pend.length,
      peso_prev: Number(viagem.peso_prev),
      peso_emb: Number(viagem.peso_emb),
      tempo_min: tempo,
    };

    await supabase.from("tms_viagens").update({
      status: "finalizada",
      finalizada_em: fim.toISOString(),
      tempo_operacao_min: tempo,
      resumo,
    } as any).eq("id", data.viagem_id);

    // propaga status para minutas com 100% embarcado
    const { data: links } = await supabase.from("tms_viagem_minutas").select("minuta_id").eq("viagem_id", data.viagem_id);
    for (const l of links ?? []) {
      const { data: vs } = await supabase.from("tms_volumes").select("status").eq("minuta_id", (l as any).minuta_id);
      const todos = vs ?? [];
      if (todos.length && todos.every((v: any) => v.status === "embarcado")) {
        await supabase.from("tms_minutas").update({ status: "em_transferencia" } as any).eq("id", (l as any).minuta_id);
      }
    }

    await supabase.from("tms_viagem_eventos").insert({
      viagem_id: data.viagem_id, tipo: "finalizada", operador_id: userId, payload: resumo,
    } as any);

    return { ok: true, resumo };
  });

export const getPainelViagem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { viagem_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: v } = await supabase.from("tms_viagens").select("*").eq("id", data.viagem_id).maybeSingle();
    if (!v) throw new Error("Viagem não encontrada");
    const { data: links } = await supabase
      .from("tms_viagem_minutas")
      .select("minuta_id, tms_minutas(id, numero, destino, qtd_volumes, peso_taxado, cancelada_em, tms_clientes(nome))")
      .eq("viagem_id", data.viagem_id);
    const minutas = (links ?? []).map((l: any) => l.tms_minutas).filter(Boolean);
    const minutaIds = minutas.map((m: any) => m.id);
    const { data: vols } = minutaIds.length
      ? await supabase.from("tms_volumes").select("id, numero, codigo, peso, status, viagem_id, bloqueado").in("minuta_id", minutaIds)
      : { data: [] as any[] };
    return { viagem: v, minutas, volumes: vols ?? [] };
  });
