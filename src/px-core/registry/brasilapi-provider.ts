import type { CnpjData, CnpjProvider } from "./cnpj-provider";

function toIsoDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  // BrasilAPI já entrega yyyy-mm-dd
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const brasilApiProvider: CnpjProvider = {
  name: "brasilapi",
  async lookup(cnpj: string): Promise<CnpjData> {
    const digits = cnpj.replace(/\D/g, "");
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (!res.ok) throw new Error(`Falha ao consultar CNPJ (status ${res.status})`);
    const j = (await res.json()) as Record<string, any>;

    return {
      cnpj: digits,
      razao_social: j.razao_social ?? null,
      nome_fantasia: j.nome_fantasia || j.razao_social || null,
      situacao_cadastral: j.descricao_situacao_cadastral ?? null,
      data_abertura: toIsoDate(j.data_inicio_atividade),
      natureza_juridica: j.natureza_juridica ?? null,
      cnae_principal: j.cnae_fiscal ? String(j.cnae_fiscal) : null,
      cnae_descricao: j.cnae_fiscal_descricao ?? null,
      cep: j.cep ? String(j.cep).replace(/\D/g, "") : null,
      logradouro: j.logradouro ?? null,
      numero: j.numero ? String(j.numero) : null,
      complemento: j.complemento ?? null,
      bairro: j.bairro ?? null,
      cidade: j.municipio ?? null,
      uf: j.uf ?? null,
      telefone: j.ddd_telefone_1 ?? null,
      email: j.email ?? null,
      raw: j,
    };
  },
};
