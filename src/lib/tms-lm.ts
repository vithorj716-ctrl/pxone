// Last Mile — utilitários e constantes
export const LM_STATUS_ROTA = {
  planejada: { label: "Planejada", color: "#3b82f6", bg: "#0b1d3a" },
  separando: { label: "Em Separação", color: "#eab308", bg: "#221d05" },
  carregando: { label: "Carregando", color: "#f97316", bg: "#221306" },
  em_rota: { label: "Em Rota", color: "#22c55e", bg: "#06210f" },
  finalizada: { label: "Finalizada", color: "#9ca3af", bg: "#161616" },
  atrasada: { label: "Atrasada", color: "#ef4444", bg: "#2a0a0a" },
  ocorrencia: { label: "Ocorrência", color: "#a855f7", bg: "#1c0a2a" },
} as const;
export type LmStatusRota = keyof typeof LM_STATUS_ROTA;

export const LM_STATUS_ENTREGA = {
  aguardando_separacao: { label: "Aguardando Separação", color: "#3b82f6" },
  separado: { label: "Separado", color: "#eab308" },
  carregado: { label: "Carregado", color: "#f97316" },
  saiu_entrega: { label: "Saiu para Entrega", color: "#22c55e" },
  tentativa_1: { label: "1ª Tentativa", color: "#a855f7" },
  tentativa_2: { label: "2ª Tentativa", color: "#a855f7" },
  entregue: { label: "Entregue", color: "#16a34a" },
  recusado: { label: "Recusado", color: "#ef4444" },
  ausente: { label: "Cliente Ausente", color: "#ef4444" },
  endereco_incorreto: { label: "Endereço Incorreto", color: "#ef4444" },
  avaria: { label: "Avaria", color: "#dc2626" },
  devolucao: { label: "Devolução", color: "#7f1d1d" },
} as const;
export type LmStatusEntrega = keyof typeof LM_STATUS_ENTREGA;

export const LM_PRIORIDADE = {
  baixa: { label: "Baixa", color: "#6b7280" },
  media: { label: "Média", color: "#3b82f6" },
  alta: { label: "Alta", color: "#f97316" },
  urgente: { label: "Urgente", color: "#ef4444" },
} as const;

export const LM_TIPOS_OCORRENCIA = [
  { key: "ausente", label: "Cliente Ausente" },
  { key: "endereco_incorreto", label: "Endereço Incorreto" },
  { key: "recusa", label: "Recusa" },
  { key: "avaria", label: "Avaria" },
  { key: "extraviado", label: "Volume Extraviado" },
  { key: "parcial", label: "Entrega Parcial" },
  { key: "fechado", label: "Estabelecimento Fechado" },
  { key: "reagendamento", label: "Reagendamento" },
  { key: "outros", label: "Outros" },
];

export function progressoRota(entregas: { status: string }[]) {
  if (!entregas.length) return 0;
  const ok = entregas.filter((e) => e.status === "entregue").length;
  return Math.round((ok / entregas.length) * 100);
}

export function isAtrasada(prevista?: string | null) {
  if (!prevista) return false;
  return new Date(prevista).getTime() < Date.now();
}
