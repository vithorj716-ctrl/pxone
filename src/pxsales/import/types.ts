// PXSales — Importação em massa de clientes (XML de visitas/atendimentos).
// Tipos compartilhados entre parser, normalização, consolidação, telas e server functions.

/** Origem de cada valor — usada para precedência e para mostrar de onde veio o dado. */
export type OrigemCampo = "receita" | "xml" | "texto" | "usuario";

export type Campo<T = string> = {
  valor: T;
  origem: OrigemCampo;
  /** trecho do XML/observação que gerou o valor (para auditoria e conferência) */
  evidencia?: string;
};

/** Registro bruto lido do XML, sem interpretação de negócio. */
export type RegistroXml = {
  /** identificador estável do registro dentro do arquivo */
  xmlId: string;
  /** campos por nome de tag normalizado (sem acento, minúsculo); repetições viram várias entradas */
  campos: Record<string, string[]>;
  /** todo o texto do registro concatenado (usado pelos extratores) */
  texto: string;
  /** mensagens/histórico quando o XML traz conversas */
  mensagens: string[];
  /** número de mensagens do registro */
  totalMensagens: number;
};

export type ContatoNormalizado = {
  nome: string | null;
  cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  setor: string;
  is_principal: boolean;
  observacoes: string | null;
};

export type EnderecoNormalizado = {
  tipo: string;
  apelido: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
};

export type ConflitoCampo = {
  campo: string;
  atual: string | null;
  novo: string | null;
  origem: OrigemCampo;
};

export type AcaoImportacao = "criar" | "atualizar" | "lead" | "revisao" | "ignorar";

/** Registro já interpretado: é isso que a tela mostra e o servidor grava. */
export type RegistroNormalizado = {
  xmlId: string;
  xmlIds: string[];
  registroHash: string;

  cnpj: string | null;
  cnpjsAdicionais: string[];
  cpf: string | null;
  inscricaoEstadual: string | null;

  razaoSocial: Campo | null;
  nomeFantasia: Campo | null;
  situacaoCadastral: Campo | null;

  endereco: EnderecoNormalizado | null;
  enderecosAdicionais: EnderecoNormalizado[];

  contatos: ContatoNormalizado[];
  telefones: string[];
  emails: string[];

  segmento: string | null;
  tipoCarga: string | null;
  rotas: string[];
  frequencia: string | null;
  volumeMensal: string | null;
  concorrente: string | null;
  potencialMensal: number | null;
  prazoPagamento: number | null;
  temperatura: "frio" | "morno" | "quente" | null;
  categorias: string[];

  responsavel: string | null;
  ultimaVisita: string | null;
  totalVisitas: number;
  totalMensagens: number;

  observacoes: string | null;
  observacoesComerciais: string | null;

  /** campos que o XML trouxe e não foram aproveitados em coluna própria */
  extras: Record<string, string[]>;

  /** qualidade do registro: 0–100 */
  score: number;
  avisos: string[];
  acaoSugerida: AcaoImportacao;
};

/** Resultado de comparação com a base atual, devolvido pelo servidor. */
export type MatchRegistro = {
  xmlId: string;
  clienteId: string | null;
  leadId: string | null;
  motivo: "cnpj" | "telefone" | "email" | "nome" | null;
  clienteResumo: {
    id: string;
    cnpj: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cidade: string | null;
    uf: string | null;
    telefone: string | null;
    email: string | null;
    ativo: boolean;
  } | null;
  conflitos: ConflitoCampo[];
  jaImportado: boolean;
};

export type ResultadoItem = {
  xmlId: string;
  status: "ok" | "erro" | "ignorado" | "revisao";
  acao: AcaoImportacao;
  clienteId: string | null;
  leadId: string | null;
  mensagem: string | null;
  empresa: string | null;
  cnpj: string | null;
};

export type ResumoImportacao = {
  importacaoId: string;
  total: number;
  criados: number;
  atualizados: number;
  leads: number;
  ignorados: number;
  revisao: number;
  erros: number;
};
