import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Target, Calculator, TrendingUp, Gavel, ShieldAlert,
  Users, Sparkles, Goal, Rocket, FileText, Clock, LogOut, Wallet, Building2,
  PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const navGroups = [
  {
    label: "Inteligência",
    items: [
      { to: "/", label: "Executive Command", icon: LayoutDashboard, exact: true },
      { to: "/business-plan", label: "Business Plan", icon: Target },
      { to: "/valuation", label: "Valuation Engine", icon: TrendingUp },
      { to: "/payback", label: "Payback Center", icon: Calculator },
      { to: "/kpis", label: "KPI Center", icon: Goal },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/empresas", label: "Empresas", icon: Building2 },
      { to: "/custos", label: "Central de Custos", icon: Wallet },
    ],
  },
  {
    label: "Governança",
    items: [
      { to: "/decisions", label: "Decision Center", icon: Gavel },
      { to: "/risk", label: "Risk Center", icon: ShieldAlert },
      { to: "/okr", label: "OKR Center", icon: Goal },
      { to: "/investor", label: "Investor Room", icon: Users },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { to: "/growth", label: "Growth Center", icon: Rocket },
      { to: "/ai-analyst", label: "Conselheiro IA", icon: Sparkles },
      { to: "/documents", label: "Documentos", icon: FileText },
      { to: "/timeline", label: "Timeline", icon: Clock },
    ],
  },
] as const;

type NavLink = { to: string; label: string; icon: any; exact?: boolean };
const ALL_LINKS: NavLink[] = navGroups.flatMap((g) => g.items as unknown as NavLink[]);


interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  rightPanel?: ReactNode;
  headerActions?: ReactNode;
}

export function AppShell({ children, title, subtitle, rightPanel, headerActions }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    try {
      const saved = localStorage.getItem("pxone:sidebar-collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    const t = () => setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    t();
    const id = setInterval(t, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
      } else if (e.key === "Escape") {
        setShowSearch(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("pxone:sidebar-collapsed", next ? "1" : "0"); } catch {}
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const filteredLinks = search.trim()
    ? ALL_LINKS.filter((l) => l.label.toLowerCase().includes(search.toLowerCase()))
    : ALL_LINKS;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`border-r border-border flex flex-col shrink-0 bg-sidebar transition-[width] duration-300 ease-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="size-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--gradient-brand)" }}>
              <span className="text-[11px] font-bold text-brand-foreground">PX</span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <span className="text-base font-semibold tracking-tight block leading-none">PXOne</span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Corporate OS</span>
              </div>
            )}
          </Link>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors"
            title={collapsed ? "Expandir (Ctrl+B)" : "Recolher (Ctrl+B)"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto thin-scroll pb-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2 pt-4 pb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="my-3 mx-3 h-px bg-border/60" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, "exact" in item ? item.exact : false);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={`group relative w-full flex items-center py-2 rounded-md text-sm transition-all duration-200 ${
                        collapsed ? "justify-center px-2" : "px-3"
                      } ${
                        active
                          ? "bg-surface-2 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface/60 hover:translate-x-0.5"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand animate-fade-in" />
                      )}
                      <Icon className={`size-4 shrink-0 ${active ? "text-brand" : ""} ${collapsed ? "" : "mr-2.5"}`} />
                      {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className={`flex items-center gap-2 p-2 rounded-lg bg-surface/60 ring-1 ring-border ${collapsed ? "justify-center" : ""}`}>
            <div className="size-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gradient-brand)" }}>
              <span className="text-[10px] font-bold text-brand-foreground">
                {(email ?? "PX").slice(0, 2).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">Diretoria</p>
                  <p className="text-[10px] text-muted-foreground truncate">{email ?? "—"}</p>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                  title="Sair"
                >
                  <LogOut className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto thin-scroll bg-background">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur-xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm font-semibold truncate">{title}</h1>
            {subtitle && (
              <>
                <div className="h-3.5 w-px bg-border" />
                <span className="text-sm text-muted-foreground truncate">{subtitle}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md ring-1 ring-border bg-surface/60 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Buscar módulo (Ctrl+K)"
            >
              <Search className="size-3.5" /> Buscar
              <kbd className="ml-2 px-1.5 py-0.5 rounded bg-surface-2 text-[10px] font-mono">⌘K</kbd>
            </button>
            {headerActions ?? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                <span className="size-1.5 rounded-full bg-brand inline-block mr-1.5 animate-pulse-glow" /> {now}
              </span>
            )}
          </div>
        </header>
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">{children}</div>
      </main>

      {/* Right panel */}
      {rightPanel && (
        <aside className="w-80 border-l border-border bg-sidebar/40 shrink-0 p-6 overflow-y-auto thin-scroll animate-fade-in">
          {rightPanel}
        </aside>
      )}

      {/* Command palette */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-32 px-4 animate-fade-in" onClick={() => setShowSearch(false)}>
          <div
            className="w-full max-w-lg bg-surface ring-1 ring-border rounded-xl overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ir para módulo…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] font-mono text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto thin-scroll p-1">
              {filteredLinks.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nada encontrado</div>
              ) : (
                filteredLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <button
                      key={l.to}
                      onClick={() => { setShowSearch(false); setSearch(""); navigate({ to: l.to as any }); }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="size-4" /> {l.label}
                    </button>
                  );
                })

              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
