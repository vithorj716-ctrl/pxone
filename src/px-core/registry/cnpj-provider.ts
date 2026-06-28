// PX Registry — abstração de provider de consulta de CNPJ.
// Implementações concretas ficam em arquivos separados (brasilapi-provider.ts etc.).
// Trocar de provider não exige alterar consumidores.

export type CnpjData = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null; // ISO yyyy-mm-dd
  natureza_juridica: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  raw: Record<string, any>;
};

export interface CnpjProvider {
  readonly name: string;
  lookup(cnpj: string): Promise<CnpjData>;
}
