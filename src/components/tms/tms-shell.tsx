import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Truck, Package, ScanLine, FileText, Search, AlertTriangle, Users, Tag, CircleDollarSign,
  Grid3x3, LogOut, MapPin, Route as RouteIcon, Camera, BarChart3, Settings,
} from "lucide-react";
import { useSystem } from "@/px-platform/system-context";
import { supabase } from "@/integrations/supabase/client";
import { PxLogLogo } from "@/components/pxlog-logo";

type NavItem = { to: string; label: string; icon: typeof Truck; exact?: boolean; group: string };

const TMS_NAV: NavItem[] = [
  { to: "/tms", label: "Dashboard", icon: Truck, exact: true, group: "Transferências" },
  { to: "/tms/solicitacoes", label: "Solicitações", icon: FileText, group: "Transferências" },
  { to: "/tms/conferencia", label: "Conferência", icon: ScanLine, group: "Transferências" },
  { to: "/tms/embarque", label: "Embarque", icon: Truck, group: "Transferências" },
  { to: "/tms/recebimento", label: "Recebimento", icon: Package, group: "Transferências" },
  { to: "/tms/entregas", label: "Entregas", icon: Package, group: "Transferências" },
  { to: "/tms/tracking", label: "Tracking", icon: Search, group: "Transferências" },
  { to: "/tms/ocorrencias", label: "Ocorrências", icon: AlertTriangle, group: "Transferências" },
  { to: "/tms/tabela-frete", label: "Tabela de Fretes", icon: Tag, group: "Transferências" },
  { to: "/tms/clientes", label: "Clientes", icon: Users, group: "Transferências" },
  { to: "/tms/financeiro", label: "Financeiro", icon: CircleDollarSign, group: "Transferências" },
  { to: "/tms/lm", label: "Dashboard", icon: MapPin, exact: true, group: "Last Mile" },
  { to: "/tms/lm/rotas", label: "Rotas", icon: RouteIcon, group: "Last Mile" },
  { to: "/tms/lm/entregas", label: "Entregas", icon: Package, group: "Last Mile" },
  { to: "/tms/lm/separacao", label: "Separação", icon: ScanLine, group: "Last Mile" },
  { to: "/tms/lm/carregamento", label: "Carregamento", icon: Truck, group: "Last Mile" },
  { to: "/tms/lm/tracking", label: "Tracking", icon: Search, group: "Last Mile" },
  { to: "/tms/lm/ocorrencias", label: "Ocorrências", icon: AlertTriangle, group: "Last Mile" },
  { to: "/tms/lm/comprovantes", label: "Comprovantes", icon: Camera, group: "Last Mile" },
  { to: "/tms/lm/relatorios", label: "Relatórios", icon: BarChart3, group: "Last Mile" },
  { to: "/tms/lm/configuracoes", label: "Configurações", icon: Settings, group: "Last Mile" },
];

const ACCENT = "#19c4d8"; // PXLog cyan
const ACCENT_BG = "#06222e";

interface TmsShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
}

export function TmsShell({ children, title, subtitle, headerActions }: TmsShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { activeSystem, setActiveSystem } = useSystem();

  // Garante contexto = TMS quando o usuário aterrissa via deep-link
  useEffect(() => {
    if (!activeSystem || activeSystem.key !== "pxlog-tms") {
      setActiveSystem("pxlog-tms");
    }
  }, [activeSystem, setActiveSystem]);

  function trocarSistema() {
    setActiveSystem(null);
    navigate({ to: "/launcher" });
  }

  async function sair() {
    setActiveSystem(null);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex h-[100dvh] overflow-hidden text-foreground" style={{ background: "#0a0a0c" }}>
      <aside className="hidden lg:flex w-64 flex-col border-r border-border shrink-0" style={{ background: "#0f0f12" }}>
        <div className="p-4 flex items-center gap-2 border-b border-border" style={{ background: "#ffffff" }}>
          <PxLogLogo height={28} />
          <div className="ml-auto text-[9px] uppercase tracking-widest text-slate-500">Transfer Hub</div>
        </div>

        <nav className="flex-1 px-2 space-y-2 overflow-y-auto thin-scroll pb-4">
          {Array.from(new Set(TMS_NAV.map((i) => i.group))).map((group) => (
            <div key={group} className="space-y-0.5">
              <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/70">{group}</div>
              {TMS_NAV.filter((i) => i.group === group).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    style={active ? { background: ACCENT_BG, boxShadow: `inset 2px 0 0 ${ACCENT}` } : undefined}
                  >
                    <Icon className="size-4 shrink-0" style={active ? { color: ACCENT } : undefined} />
                    <span className="font-medium truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={trocarSistema}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <Grid3x3 className="size-4" /> Trocar Sistema
          </button>
          <button
            onClick={sair}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto thin-scroll min-w-0" style={{ background: "#0a0a0c" }}>
        <header className="sticky top-0 z-20 h-14 border-b border-border px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 backdrop-blur-xl" style={{ background: "rgba(10,10,12,0.85)" }}>
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate">{title}</h1>
            {subtitle && (
              <>
                <div className="h-3.5 w-px bg-border hidden sm:block" />
                <span className="text-sm text-muted-foreground truncate hidden sm:inline">{subtitle}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={trocarSistema}
              className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <Grid3x3 className="size-3.5" /> Trocar Sistema
            </button>
          </div>
        </header>
        <div className="p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
