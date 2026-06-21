import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Target,
  Calculator,
  TrendingUp,
  Gavel,
  ShieldAlert,
  Users,
  Sparkles,
  Goal,
  Rocket,
  FileText,
  Clock,
  LogOut,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

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
      { to: "/ai-analyst", label: "AI Analyst", icon: Sparkles },
      { to: "/documents", label: "Documentos", icon: FileText },
      { to: "/timeline", label: "Timeline", icon: Clock },
    ],
  },
] as const;

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
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col shrink-0 bg-sidebar">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-6 bg-brand rounded-sm" />
            <span className="text-lg font-semibold tracking-tight">PXOne</span>
          </Link>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Sistema Operacional Corporativo
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar pb-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pt-4 pb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, "exact" in item ? item.exact : false);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`w-full flex items-center py-2 pr-3 pl-2 rounded-md text-sm transition-colors ${
                        active
                          ? "bg-surface-2 text-foreground ring-1 ring-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                      }`}
                    >
                      <Icon className="size-4 mr-2 shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-surface/60 ring-1 ring-border">
            <div className="size-8 rounded-full bg-surface-2 flex items-center justify-center border border-border">
              <span className="text-[10px] font-medium">
                {(email ?? "PX").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">Diretoria Executiva</p>
              <p className="text-[10px] text-muted-foreground truncate">{email ?? "—"}</p>
            </div>
            <button
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-background">
        <header className="sticky top-0 z-10 h-16 border-b border-border bg-background/80 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-foreground">{title}</h1>
            {subtitle && (
              <>
                <div className="h-4 w-px bg-border" />
                <span className="text-sm text-muted-foreground">{subtitle}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {headerActions ?? (
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Atualizado: Agora
              </button>
            )}
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto space-y-8">{children}</div>
      </main>

      {/* Right panel */}
      {rightPanel && (
        <aside className="w-80 border-l border-border bg-sidebar/40 shrink-0 p-6 overflow-y-auto no-scrollbar">
          {rightPanel}
        </aside>
      )}
    </div>
  );
}
