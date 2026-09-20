import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Sparkles, Building2, Users, Target, FileSpreadsheet, FileSignature,
  CalendarClock, CalendarDays, Percent, Share2, Search, BarChart3, Settings,
  Grid3x3, LogOut, Menu, X, Bell, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystem } from "@/px-platform/system-context";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { getPxSalesAccess, touchPxSalesAccess } from "@/lib/pxsales.functions";

export const PXSALES_ACCENT = "#e11d48";
const ACCENT_BG = "#2a0713";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; group: string };

export const PXSALES_NAV: NavItem[] = [
  { to: "/sales", label: "Dashboard", icon: LayoutDashboard, exact: true, group: "Comercial" },
  { to: "/sales/leads", label: "Leads", icon: Sparkles, group: "Comercial" },
  { to: "/sales/clientes", label: "Empresas", icon: Building2, group: "Comercial" },
  { to: "/sales/contatos", label: "Contatos", icon: Users, group: "Comercial" },
  { to: "/sales/oportunidades", label: "Oportunidades", icon: Target, group: "Comercial" },
  { to: "/sales/cotacoes", label: "Cotações", icon: FileSpreadsheet, group: "Negociação" },
  { to: "/sales/propostas", label: "Propostas", icon: FileSignature, group: "Negociação" },
  { to: "/sales/followups", label: "Follow-ups", icon: CalendarClock, group: "Negociação" },
  { to: "/sales/agenda", label: "Agenda", icon: CalendarDays, group: "Negociação" },
  { to: "/sales/comissoes", label: "Comissões", icon: Percent, group: "Gestão" },
  { to: "/sales/portal", label: "Portal do Cliente", icon: Share2, group: "Gestão" },
  { to: "/sales/tracking", label: "Tracking", icon: Search, group: "Gestão" },
  { to: "/sales/relatorios", label: "Relatórios", icon: BarChart3, group: "Gestão" },
  { to: "/sales/configuracoes", label: "Configurações", icon: Settings, group: "Gestão" },
];

const BOTTOM_NAV = PXSALES_NAV.filter((i) =>
  ["/sales", "/sales/leads", "/sales/clientes", "/sales/cotacoes"].includes(i.to),
);

interface Props {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
}

export function PxSalesShell({ children, title, subtitle, headerActions }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { activeSystem, setActiveSystem } = useSystem();
  const { empresa, isGrupo, empresas, setEmpresa } = useEmpresaAtiva();
  const [menuOpen, setMenuOpen] = useState(false);
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const fetchAccess = useServerFn(getPxSalesAccess);
  const touch = useServerFn(touchPxSalesAccess);
  const { data: access, isLoading } = useQuery({
    queryKey: ["pxsales", "access"],
    queryFn: () => fetchAccess(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!activeSystem || activeSystem.key !== "pxsales") setActiveSystem("pxsales");
  }, [activeSystem, setActiveSystem]);

  useEffect(() => {
    if (access?.allowed) void Promise.resolve((touch as any)()).catch(() => {});
  }, [access?.allowed, touch]);

  useEffect(() => {
    if (!isLoading && access && !access.allowed) {
      navigate({ to: "/sales/login", replace: true });
    }
  }, [isLoading, access, navigate]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const groups = useMemo(() => Array.from(new Set(PXSALES_NAV.map((i) => i.group))), []);
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  function trocarSistema() {
    setActiveSystem(null);
    navigate({ to: "/launcher" });
  }

  async function sair() {
    setActiveSystem(null);
    await supabase.auth.signOut();
    navigate({ to: "/sales/login" });
  }

  function submitBusca(e: React.FormEvent) {
    e.preventDefault();
    const q = busca.trim();
    if (!q) return;
    navigate({ to: "/sales/clientes", search: { q } as any });
  }

  if (isLoading || !access?.allowed) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0a0a0c] text-muted-foreground text-sm">
        {isLoading ? "Carregando PXSales…" : "Redirecionando…"}
      </div>
    );
  }

  const sidebar = (
    <nav className="flex-1 px-2 space-y-2 overflow-y-auto thin-scroll pb-4">
      {groups.map((group) => (
        <div key={group} className="space-y-0.5">
          <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/70">{group}</div>
          {PXSALES_NAV.filter((i) => i.group === group).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                style={active ? { background: ACCENT_BG, boxShadow: `inset 2px 0 0 ${PXSALES_ACCENT}` } : undefined}
              >
                <Icon className="size-4 shrink-0" style={active ? { color: PXSALES_ACCENT } : undefined} />
                <span className="font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden text-foreground" style={{ background: "#0a0a0c" }}>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border shrink-0" style={{ background: "#0f0f12" }}>
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
          <div className="size-7 rounded-md flex items-center justify-center" style={{ background: PXSALES_ACCENT }}>
            <span className="text-[11px] font-bold text-white">PX</span>
          </div>
          <div className="leading-none">
            <div className="text-sm font-semibold">PXSales</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Comercial</div>
          </div>
        </div>
        {sidebar}
        <div className="p-3 border-t border-border space-y-1">
          <button onClick={trocarSistema} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5">
            <Grid3x3 className="size-4" /> Trocar Sistema
          </button>
          <button onClick={sair} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] flex flex-col border-r border-border" style={{ background: "#0f0f12" }}>
            <div className="h-14 px-4 flex items-center justify-between border-b border-border">
              <div className="text-sm font-semibold">PXSales</div>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 text-muted-foreground"><X className="size-4" /></button>
            </div>
            {sidebar}
            <div className="p-3 border-t border-border space-y-1">
              <button onClick={trocarSistema} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground"><Grid3x3 className="size-4" /> Trocar Sistema</button>
              <button onClick={sair} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground"><LogOut className="size-4" /> Sair</button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto thin-scroll min-w-0">
        <header className="sticky top-0 z-20 border-b border-border backdrop-blur-xl" style={{ background: "rgba(10,10,12,0.9)" }}>
          <div className="h-14 px-3 sm:px-4 lg:px-6 flex items-center gap-2">
            <button onClick={() => setMenuOpen(true)} className="lg:hidden p-2 -ml-1 rounded-md text-muted-foreground hover:text-foreground">
              <Menu className="size-4" />
            </button>
            <div className="min-w-0 flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate">{title}</h1>
              {subtitle && (
                <>
                  <div className="h-3.5 w-px bg-border hidden sm:block" />
                  <span className="text-sm text-muted-foreground truncate hidden sm:inline">{subtitle}</span>
                </>
              )}
            </div>

            <form onSubmit={submitBusca} className="ml-auto hidden md:flex items-center gap-2 rounded-md ring-1 ring-border px-2 py-1.5 w-64 bg-background/50">
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="CNPJ, cliente, cotação, minuta…"
                className="bg-transparent text-xs outline-none w-full"
              />
            </form>

            <div className="ml-auto md:ml-0 flex items-center gap-1.5">
              {headerActions}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setEmpresaOpen((v) => !v)}
                  className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 max-w-[10rem]"
                >
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="truncate">{isGrupo ? "Grupo PX" : empresa?.nome_fantasia || empresa?.nome}</span>
                  <ChevronDown className="size-3 shrink-0" />
                </button>
                {empresaOpen && (
                  <div className="absolute right-0 mt-1 w-56 rounded-md ring-1 ring-border bg-[#101014] p-1 z-30 max-h-72 overflow-y-auto thin-scroll">
                    <button onClick={() => { setEmpresa(null); setEmpresaOpen(false); }} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white/5">Grupo PX (todas)</button>
                    {empresas.map((e) => (
                      <button key={e.id} onClick={() => { setEmpresa(e.id); setEmpresaOpen(false); }} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white/5 truncate">
                        {e.nome_fantasia || e.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="p-2 rounded-md text-muted-foreground hover:text-foreground relative" title="Notificações">
                <Bell className="size-4" />
              </button>
              <button onClick={trocarSistema} className="hidden sm:inline-flex p-2 rounded-md text-muted-foreground hover:text-foreground" title="Trocar sistema">
                <Grid3x3 className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <div key={pathname} className="p-3 sm:p-5 lg:p-7 max-w-[1500px] mx-auto space-y-4 sm:space-y-5 pb-24 lg:pb-8 animate-route-enter">
          {children}
        </div>
      </main>

      {/* Bottom navigation mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border grid grid-cols-5" style={{ background: "rgba(15,15,18,0.97)" }}>
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link key={item.to} to={item.to} className="flex flex-col items-center gap-0.5 py-2 text-[10px]"
              style={{ color: active ? PXSALES_ACCENT : undefined }}>
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
          <MoreHorizontal className="size-4" />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
