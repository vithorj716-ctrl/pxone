// PXSales — tipos compartilhados do domínio comercial.
// Mantidos compatíveis com src/px-integration/crm.ts para permitir que o CRM
// seja extraído para um serviço/API independente no futuro sem reescrever a UI.

export type PxSalesAccess = {
  allowed: boolean;
  isAdmin: boolean;
  permissoes: string[];
};

export type PipelineEtapa =
  | "novo_lead"
  | "qualificacao"
  | "contato"
  | "cotacao"
  | "proposta_enviada"
  | "negociacao"
  | "ganho"
  | "perdido";

export const PIPELINE_ETAPAS: { key: PipelineEtapa; label: string; cor: string }[] = [
  { key: "novo_lead", label: "Novo Lead", cor: "#64748b" },
  { key: "qualificacao", label: "Qualificação", cor: "#0ea5e9" },
  { key: "contato", label: "Contato", cor: "#6366f1" },
  { key: "cotacao", label: "Cotação", cor: "#a855f7" },
  { key: "proposta_enviada", label: "Proposta Enviada", cor: "#f59e0b" },
  { key: "negociacao", label: "Negociação", cor: "#f97316" },
  { key: "ganho", label: "Ganho", cor: "#10b981" },
  { key: "perdido", label: "Perdido", cor: "#ef4444" },
];
