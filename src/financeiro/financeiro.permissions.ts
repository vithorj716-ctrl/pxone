// Financeiro PX — catálogo de permissões.
// Reutiliza a infra existente: px_perfis / px_perfil_permissoes / px_usuario_perfis
// e o gate de sistema px_usuario_sistemas + has_system_access().

export const FINANCEIRO_SISTEMA_KEY = "pxfin" as const;

export const FINANCEIRO_PERMISSIONS = [
  { acao: "financeiro.view", grupo: "Geral", label: "Acessar o Financeiro" },
  { acao: "financeiro.dashboard.view", grupo: "Geral", label: "Ver visão geral financeira" },
  { acao: "financeiro.contas_pagar.view", grupo: "Movimentação", label: "Ver contas a pagar" },
  { acao: "financeiro.contas_pagar.manage", grupo: "Movimentação", label: "Gerenciar contas a pagar" },
  { acao: "financeiro.contas_receber.view", grupo: "Movimentação", label: "Ver contas a receber" },
  { acao: "financeiro.contas_receber.manage", grupo: "Movimentação", label: "Gerenciar contas a receber" },
  { acao: "financeiro.pagamentos.view", grupo: "Movimentação", label: "Ver pagamentos" },
  { acao: "financeiro.pagamentos.manage", grupo: "Movimentação", label: "Registrar pagamentos" },
  { acao: "financeiro.recebimentos.view", grupo: "Movimentação", label: "Ver recebimentos" },
  { acao: "financeiro.recebimentos.manage", grupo: "Movimentação", label: "Registrar recebimentos" },
  { acao: "financeiro.adiantamentos.view", grupo: "Pessoas", label: "Ver adiantamentos" },
  { acao: "financeiro.adiantamentos.manage", grupo: "Pessoas", label: "Gerenciar adiantamentos" },
  { acao: "financeiro.adiantamentos.approve", grupo: "Pessoas", label: "Aprovar adiantamentos" },
  { acao: "financeiro.colaboradores.view", grupo: "Pessoas", label: "Ver colaboradores e prestadores" },
  { acao: "financeiro.colaboradores.manage", grupo: "Pessoas", label: "Gerenciar colaboradores e prestadores" },
  { acao: "financeiro.folha.view", grupo: "Pessoas", label: "Ver folha/pagamentos" },
  { acao: "financeiro.folha.manage", grupo: "Pessoas", label: "Gerenciar folha/pagamentos" },
  { acao: "financeiro.folha.approve", grupo: "Pessoas", label: "Aprovar folha/pagamentos" },
  { acao: "financeiro.recibos.view", grupo: "Documentos", label: "Ver recibos" },
  { acao: "financeiro.recibos.generate", grupo: "Documentos", label: "Emitir recibos" },
  { acao: "financeiro.comissoes.view", grupo: "Comercial", label: "Ver comissões a pagar" },
  { acao: "financeiro.comissoes.pay", grupo: "Comercial", label: "Pagar comissões" },
  { acao: "financeiro.faturamento.view", grupo: "Comercial", label: "Ver faturamento" },
  { acao: "financeiro.faturamento.manage", grupo: "Comercial", label: "Faturar operações" },
  { acao: "financeiro.conciliacao.view", grupo: "Conciliação", label: "Ver conciliação" },
  { acao: "financeiro.conciliacao.manage", grupo: "Conciliação", label: "Conciliar movimentos" },
  { acao: "financeiro.relatorios.view", grupo: "Relatórios", label: "Ver relatórios financeiros" },
  { acao: "financeiro.settings.manage", grupo: "Configurações", label: "Gerenciar contas, categorias e centros de custo" },
] as const;

export type FinanceiroPermission = (typeof FINANCEIRO_PERMISSIONS)[number]["acao"];

export const FINANCEIRO_PERMISSION_ACTIONS: FinanceiroPermission[] =
  FINANCEIRO_PERMISSIONS.map((p) => p.acao);
