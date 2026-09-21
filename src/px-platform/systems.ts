// PX Platform — Registry de SISTEMAS (não confundir com módulos internos do ERP).
// Cada sistema é uma aplicação independente que compartilha a mesma infraestrutura.

export type SystemStatus = "ativo" | "planejado";

export type PxSystem = {
  key: string;
  nome: string;
  descricao: string;
  rota: string; // rota inicial ao entrar
  icone: string; // lucide name
  cor: string; // hex
  status: SystemStatus;
};

export const PX_SYSTEMS: PxSystem[] = [
  {
    key: "pxone-erp",
    nome: "PXOne ERP",
    descricao: "ERP corporativo: dashboards, financeiro, custos, markup, KPIs e governança.",
    rota: "/",
    icone: "LayoutDashboard",
    cor: "#7c3aed",
    status: "ativo",
  },
  {
    key: "pxlog-tms",
    nome: "PXLog TMS",
    descricao: "Transfer Hub: minutas, conferência, embarque, tracking e fretes.",
    rota: "/tms",
    icone: "Truck",
    cor: "#f97316",
    status: "ativo",
  },
  {
    key: "pxsales",
    nome: "PXSales",
    descricao: "CRM e gestão comercial para operações logísticas.",
    rota: "/sales",
    icone: "Handshake",
    cor: "#e11d48",
    status: "ativo",
  },
  {
    key: "pxfin",
    nome: "Financeiro PX",
    descricao: "Contas a pagar e receber, pagamentos, adiantamentos, faturamento, recibos e conciliação.",
    rota: "/financeiro",
    icone: "Landmark",
    cor: "#22c55e",
    status: "ativo",
  },
  {
    key: "pxmed",
    nome: "PXMed",
    descricao: "Gestão para a área médica do Grupo PX.",
    rota: "/pxmed",
    icone: "Stethoscope",
    cor: "#06b6d4",
    status: "planejado",
  },
  {
    key: "pxfarma",
    nome: "PXFarma",
    descricao: "Gestão farmacêutica do Grupo PX.",
    rota: "/pxfarma",
    icone: "Pill",
    cor: "#10b981",
    status: "planejado",
  },
];

export function getSystem(key: string) {
  return PX_SYSTEMS.find((s) => s.key === key);
}

// Rota → sistema (para gate de isolamento)
export function systemFromPath(pathname: string): string {
  if (pathname === "/launcher" || pathname.startsWith("/admin") || pathname.startsWith("/conta")) {
    return "platform";
  }
  if (pathname === "/tms" || pathname.startsWith("/tms/")) return "pxlog-tms";
  if (pathname === "/financeiro" || pathname.startsWith("/financeiro/")) return "pxfin";
  if (pathname === "/sales" || pathname.startsWith("/sales/")) return "pxsales";
  if (pathname.startsWith("/pxmed")) return "pxmed";
  if (pathname.startsWith("/pxfarma")) return "pxfarma";
  return "pxone-erp";
}
