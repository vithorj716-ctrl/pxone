// PX Platform — tipos compartilhados da camada PX Core.
// Esta camada é aditiva: não substitui nem altera nenhum módulo existente.

export type ModuleStatus = "ativo" | "beta" | "planejado" | "desativado";

export type ModuleDefinition = {
  key: string;
  nome: string;
  icone: string; // nome do lucide-react
  versao: string;
  status: ModuleStatus;
  descricao: string;
  rotas: string[];
  permissoes: string[];
  eventos: string[];
  apis: string[];
};

export type PxEventType =
  | "venda.criada"
  | "cliente.criado"
  | "cliente.atualizado"
  | "fornecedor.criado"
  | "fornecedor.atualizado"
  | "produto.criado"
  | "custo.lancado"
  | "despesa.aprovada"
  | "faturamento.realizado"
  | "frete.entregue"
  | "pagamento.recebido"
  | "kpi.atualizado"
  | "ia.consultada"
  | (string & {});

export type PxEvent = {
  tipo: PxEventType;
  origem?: string;
  payload?: Record<string, unknown>;
};
