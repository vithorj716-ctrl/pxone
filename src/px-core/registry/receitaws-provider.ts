import type { CnpjData, CnpjProvider } from "./cnpj-provider";

function toIsoFromBr(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export const receitaWsProvider: CnpjProvider = {
  name: "receitaws",
  async lookup(cnpj: string): Promise<CnpjData> {
    const digits = cnpj.replace(/\D/g, "");
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (!res.ok) throw new Error(`Falha ao consultar CNPJ (status ${res.status})`);
    const j = (await res.json()) as Record<string, any>;
    if (j.status === "ERROR") throw new Error(j.message || "CNPJ não encontrado");

    const cnaePrincipal = Array.isArray(j.atividade_principal) && j.atividade_principal[0];

    return {
      cnpj: digits,
      razao_social: j.nome ?? null,
      nome_fantasia: j.fantasia || j.nome || null,
      situacao_cadastral: j.situacao ?? null,
      data_abertura: toIsoFromBr(j.abertura),
      natureza_juridica: j.natureza_juridica ?? null,
      cnae_principal: cnaePrincipal?.code ? String(cnaePrincipal.code).replace(/\D/g, "") : null,
      cnae_descricao: cnaePrincipal?.text ?? null,
      cep: j.cep ? String(j.cep).replace(/\D/g, "") : null,
      logradouro: j.logradouro ?? null,
      numero: j.numero ? String(j.numero) : null,
      complemento: j.complemento ?? null,
      bairro: j.bairro ?? null,
      cidade: j.municipio ?? null,
      uf: j.uf ?? null,
      telefone: j.telefone ?? null,
      email: j.email ?? null,
      raw: j,
    };
  },
};
