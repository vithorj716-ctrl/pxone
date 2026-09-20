// PXSales — catálogo de permissões.
// Mapeia para a infra existente: px_perfis / px_perfil_permissoes / px_usuario_perfis
// e o gate de sistema px_usuario_sistemas + has_system_access().
// NÃO cria um segundo sistema de permissões.

export const PXSALES_SISTEMA_KEY = "pxsales" as const;

export const PXSALES_PERMISSIONS = [
  { acao: "pxsales.dashboard.view", grupo: "Dashboard", label: "Ver dashboard comercial" },
  { acao: "pxsales.leads.view", grupo: "Leads", label: "Ver leads" },
  { acao: "pxsales.leads.create", grupo: "Leads", label: "Criar leads" },
  { acao: "pxsales.leads.edit", grupo: "Leads", label: "Editar leads" },
  { acao: "pxsales.clientes.view", grupo: "Clientes", label: "Ver clientes" },
  { acao: "pxsales.clientes.edit", grupo: "Clientes", label: "Editar clientes" },
  { acao: "pxsales.clientes.financeiro.view", grupo: "Clientes", label: "Ver dados financeiros do cliente" },
  { acao: "pxsales.oportunidades.view", grupo: "Oportunidades", label: "Ver oportunidades" },
  { acao: "pxsales.oportunidades.edit", grupo: "Oportunidades", label: "Editar oportunidades" },
  { acao: "pxsales.cotacoes.view", grupo: "Cotações", label: "Ver cotações" },
  { acao: "pxsales.cotacoes.create", grupo: "Cotações", label: "Criar cotações" },
  { acao: "pxsales.cotacoes.edit", grupo: "Cotações", label: "Editar cotações" },
  { acao: "pxsales.cotacoes.approve", grupo: "Cotações", label: "Aprovar cotações" },
  { acao: "pxsales.propostas.view", grupo: "Propostas", label: "Ver propostas" },
  { acao: "pxsales.propostas.create", grupo: "Propostas", label: "Criar propostas" },
  { acao: "pxsales.portal.manage", grupo: "Portal", label: "Gerenciar portal do cliente" },
  { acao: "pxsales.tracking.view", grupo: "Tracking", label: "Ver tracking" },
  { acao: "pxsales.comissoes.view", grupo: "Comissões", label: "Ver comissões" },
  { acao: "pxsales.comissoes.manage", grupo: "Comissões", label: "Gerenciar comissões" },
  { acao: "pxsales.settings.manage", grupo: "Configurações", label: "Gerenciar configurações" },
  { acao: "pxsales.reports.view", grupo: "Relatórios", label: "Ver relatórios" },
] as const;

export type PxSalesPermission = (typeof PXSALES_PERMISSIONS)[number]["acao"];

export const PXSALES_PERMISSION_ACTIONS: PxSalesPermission[] =
  PXSALES_PERMISSIONS.map((p) => p.acao);

/** Papéis comerciais previstos (mapeados a perfis em px_perfis). */
export const PXSALES_PAPEIS = [
  { key: "pxsales_admin", nome: "PXSales • Administrador", permissoes: PXSALES_PERMISSION_ACTIONS },
  {
    key: "pxsales_gerente",
    nome: "PXSales • Gerente Comercial",
    permissoes: PXSALES_PERMISSION_ACTIONS.filter((a) => a !== "pxsales.settings.manage"),
  },
  {
    key: "pxsales_comercial",
    nome: "PXSales • Comercial",
    permissoes: [
      "pxsales.dashboard.view",
      "pxsales.leads.view",
      "pxsales.leads.create",
      "pxsales.leads.edit",
      "pxsales.clientes.view",
      "pxsales.clientes.edit",
      "pxsales.oportunidades.view",
      "pxsales.oportunidades.edit",
      "pxsales.cotacoes.view",
      "pxsales.cotacoes.create",
      "pxsales.cotacoes.edit",
      "pxsales.propostas.view",
      "pxsales.propostas.create",
      "pxsales.portal.manage",
      "pxsales.tracking.view",
      "pxsales.comissoes.view",
    ] as PxSalesPermission[],
  },
  {
    key: "pxsales_prevendas",
    nome: "PXSales • Pré-vendas",
    permissoes: [
      "pxsales.dashboard.view",
      "pxsales.leads.view",
      "pxsales.leads.create",
      "pxsales.leads.edit",
      "pxsales.clientes.view",
      "pxsales.oportunidades.view",
    ] as PxSalesPermission[],
  },
  {
    key: "pxsales_visualizacao",
    nome: "PXSales • Visualização",
    permissoes: [
      "pxsales.dashboard.view",
      "pxsales.leads.view",
      "pxsales.clientes.view",
      "pxsales.oportunidades.view",
      "pxsales.cotacoes.view",
      "pxsales.propostas.view",
      "pxsales.tracking.view",
      "pxsales.reports.view",
    ] as PxSalesPermission[],
  },
] as const;

export function hasPxSalesPermission(
  permissoes: string[] | null | undefined,
  acao: PxSalesPermission,
): boolean {
  return !!permissoes?.includes(acao);
}
