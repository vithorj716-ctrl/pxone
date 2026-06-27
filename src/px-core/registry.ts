// PX Module Registry — fonte única dos módulos da plataforma.
// Edição: adicione novos módulos aqui; nunca remova entradas em uso.

import type { ModuleDefinition } from "./types";

export const PX_MODULES: ModuleDefinition[] = [
  {
    key: "pxone-erp",
    nome: "PXOne ERP",
    icone: "Building2",
    versao: "1.0.0",
    status: "ativo",
    descricao: "Núcleo operacional: empresas, custos, KPIs e governança.",
    rotas: ["/", "/empresas", "/custos", "/kpis"],
    permissoes: ["core.read", "core.write"],
    eventos: ["custo.lancado", "kpi.atualizado"],
    apis: ["coreEmpresas", "coreCustos", "coreKpis"],
  },
  {
    key: "markup-engine",
    nome: "Markup Engine",
    icone: "Tag",
    versao: "1.0.0",
    status: "ativo",
    descricao: "Precificação inteligente baseada em custos reais.",
    rotas: ["/markup"],
    permissoes: ["markup.read", "markup.write"],
    eventos: ["produto.criado"],
    apis: ["coreCustos", "coreEmpresas"],
  },
  {
    key: "financial-intelligence",
    nome: "Financial Intelligence",
    icone: "Brain",
    versao: "1.0.0",
    status: "ativo",
    descricao: "DRE, DFC, ponto de equilíbrio e cockpit do CEO.",
    rotas: ["/financial-intelligence"],
    permissoes: ["finance.read"],
    eventos: ["kpi.atualizado"],
    apis: ["coreCustos", "coreKpis"],
  },
  {
    key: "business-plan",
    nome: "Business Plan",
    icone: "Target",
    versao: "1.0.0",
    status: "ativo",
    descricao: "Planejamento estratégico e cenários.",
    rotas: ["/business-plan"],
    permissoes: ["plan.read", "plan.write"],
    eventos: [],
    apis: ["coreEmpresas"],
  },
  {
    key: "kpi-center",
    nome: "KPI Center",
    icone: "Goal",
    versao: "1.0.0",
    status: "ativo",
    descricao: "Indicadores e snapshots históricos.",
    rotas: ["/kpis"],
    permissoes: ["kpi.read", "kpi.write"],
    eventos: ["kpi.atualizado"],
    apis: ["coreKpis"],
  },
  {
    key: "executive-command",
    nome: "Executive Command",
    icone: "LayoutDashboard",
    versao: "1.0.0",
    status: "ativo",
    descricao: "Dashboard executivo consolidado.",
    rotas: ["/"],
    permissoes: ["exec.read"],
    eventos: [],
    apis: ["coreDashboard"],
  },
  {
    key: "swot",
    nome: "SWOT",
    icone: "ShieldAlert",
    versao: "0.1.0",
    status: "planejado",
    descricao: "Matriz SWOT estratégica integrada ao PX Core.",
    rotas: [],
    permissoes: ["swot.read"],
    eventos: [],
    apis: ["coreEmpresas"],
  },
  // Reservados — não implementados, apenas declarados:
  { key: "pxsales", nome: "PXSales", icone: "Rocket", versao: "0.0.0", status: "planejado", descricao: "CRM e gestão comercial.", rotas: [], permissoes: [], eventos: ["venda.criada", "cliente.criado"], apis: [] },
  { key: "pxtms", nome: "PXTMS", icone: "Truck", versao: "0.0.0", status: "planejado", descricao: "Gestão de transporte e fretes.", rotas: [], permissoes: [], eventos: ["frete.entregue"], apis: [] },
  { key: "pxfleet", nome: "PXFleet", icone: "Car", versao: "0.0.0", status: "planejado", descricao: "Gestão de frota.", rotas: [], permissoes: [], eventos: [], apis: [] },
  { key: "pxrh", nome: "PXRH", icone: "Users", versao: "0.0.0", status: "planejado", descricao: "Recursos humanos.", rotas: [], permissoes: [], eventos: [], apis: [] },
  { key: "pxbi", nome: "PXBI", icone: "BarChart3", versao: "0.0.0", status: "planejado", descricao: "Business intelligence avançado.", rotas: [], permissoes: [], eventos: [], apis: [] },
  { key: "pxdocs", nome: "PXDocs", icone: "FileText", versao: "0.0.0", status: "planejado", descricao: "Gestão documental.", rotas: [], permissoes: [], eventos: [], apis: [] },
  { key: "pxai", nome: "PXAI", icone: "Sparkles", versao: "0.0.0", status: "planejado", descricao: "Assistente de IA transversal.", rotas: [], permissoes: [], eventos: ["ia.consultada"], apis: [] },
];

export function getModule(key: string) {
  return PX_MODULES.find((m) => m.key === key);
}

export function listActiveModules() {
  return PX_MODULES.filter((m) => m.status === "ativo");
}
