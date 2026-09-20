import { createServerFn } from "@tanstack/react-start";

// PXSales — acompanhamento público lendo os dados reais do PXLog (sem duplicar informação).
// Exige número + documento do contratante e limita tentativas para impedir varredura.

export type RastreioEvento = {
  tipo: string;
  data: string;
};

export type RastreioResultado = {
  numero: number;
  status: string;
  origem: string | null;
  destino: string | null;
  previsao_dias: number | null;
  criada_em: string;
  eventos: RastreioEvento[];
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const soDigitos = (v: string) => (v ?? "").replace(/\D/g, "");

export async function origemChamada(): Promise<string> {
  try {
    const h = (await import("@tanstack/react-start/server")).getRequest()?.headers;
    return (
      h?.get("cf-connecting-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h?.get("x-real-ip") ||
      "anon"
    );
  } catch {
    return "anon";
  }
}

/** Limite de tentativas por origem; erro amigável quando estourado. */
export async function limitarTentativas(sb: any, escopo: string, chave: string, max: number, janelaSeg: number) {
  const { data, error } = await sb.rpc("pxsales_rate_limit", {
    p_escopo: escopo,
    p_chave: chave,
    p_max: max,
    p_janela_seg: janelaSeg,
  });
  if (error) return; // nunca derruba a consulta por falha do contador
  if (data === false) throw new Error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
}

/**
 * Consulta pública: exige o número do embarque E o CNPJ/CPF do cliente,
 * para que ninguém veja um embarque apenas chutando números.
 */
export const rastrearEmbarque = createServerFn({ method: "POST" })
  .inputValidator((d: { numero: string; documento: string }) => {
    if (!d?.numero?.toString().trim()) throw new Error("Informe o número do embarque.");
    if (soDigitos(d?.documento ?? "").length < 11) throw new Error("Informe o CNPJ ou CPF do contratante.");
    return d;
  })
  .handler(async ({ data }): Promise<RastreioResultado> => {
    const sb = await admin();
    await limitarTentativas(sb, "rastreio", await origemChamada(), 20, 600);

    const numero = parseInt(String(data.numero).replace(/\D/g, ""), 10);
    if (!Number.isFinite(numero)) throw new Error("Número do embarque inválido.");

    const { data: m } = await sb
      .from("tms_minutas")
      .select("id,numero,status,origem,destino,prazo_dias,created_at,cliente_id")
      .eq("numero", numero)
      .maybeSingle();
    if (!m) throw new Error("Embarque não encontrado. Confira o número e o documento.");

    const doc = soDigitos(data.documento);
    let confere = false;
    if (m.cliente_id) {
      const { data: cli } = await sb
        .from("tms_clientes")
        .select("cnpj,registry_id")
        .eq("id", m.cliente_id)
        .maybeSingle();
      if (cli) {
        if (soDigitos(cli.cnpj ?? "") === doc) confere = true;
        if (!confere && cli.registry_id) {
          const { data: reg } = await sb
            .from("px_registry_clientes")
            .select("cnpj")
            .eq("id", cli.registry_id)
            .maybeSingle();
          if (reg && soDigitos(reg.cnpj ?? "") === doc) confere = true;
        }
      }
    }
    if (!confere) throw new Error("Embarque não encontrado. Confira o número e o documento.");

    const { data: evs } = await sb
      .from("tms_eventos")
      .select("tipo,created_at")
      .eq("minuta_id", m.id)
      .order("created_at", { ascending: true })
      .limit(100);

    return {
      numero: Number(m.numero),
      status: m.status,
      origem: m.origem ?? null,
      destino: m.destino ?? null,
      previsao_dias: m.prazo_dias ?? null,
      criada_em: m.created_at,
      eventos: (evs ?? []).map((e: any) => ({ tipo: e.tipo, data: e.created_at })),
    };
  });
