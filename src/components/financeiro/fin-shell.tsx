import { PxGrupoLogo } from "@/components/px-logo";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle, Repeat, Users, HandCoins,
  CalendarRange, FileSignature, Percent, Scale, ReceiptText, BarChart3, Settings,
  Grid3x3, LogOut, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystem } from "@/px-platform/system-context";
import { EmpresaSelector } from "@/components/empresa-selector";

export const FIN_ACCENT = "#22c55e";
const ACCENT_BG = "#07210f";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; group: string };

export const FIN_NAV: NavItem[] = [
  { to: "/financeiro", label: "Visão geral", icon: LayoutDashboard, exact: true, group: "Financeiro" },
  { to: "/financeiro/pagar", label: "Contas a pagar", icon: ArrowUpCircle, group: "Movimentação" },
  { to: "/financeiro/receber", label: "Contas a receber", icon: ArrowDownCircle, group: "Movimentação" },
  { to: "/financeiro/movimentos", label: "Pagamentos e recebimentos", icon: Repeat, group: "Movimentação" },
  { to: "/financeiro/pessoas", label: "Colaboradores e prestadores", icon: Users, group: "Pessoas e pagamentos" },
  { to: "/financeiro/adiantamentos", label: "Adiantamentos", icon: HandCoins, group: "Pessoas e pagamentos" },
  { to: "/financeiro/folha", label: "Folha/Pagamentos", icon: CalendarRange, group: "Pessoas e pagamentos" },
  { to: "/financeiro/faturamento", label: "Faturamento", icon: FileSignature, group: "Comercial" },
  { to: "/financeiro/comissoes", label: "Comissões", icon: Percent, group: "Comercial" },
  { to: "/financeiro/conciliacao", label: "Conciliação", icon: Scale, group: "Conciliação" },
  { to: "/financeiro/recibos", label: "Recibos", icon: ReceiptText, group: "Documentos" },
  { to: "/financeiro/relatorios", label: "Relatórios", icon: BarChart3, group: "Documentos" },
  { to: "/financeiro/configuracoes", label: "Contas e categorias", icon: Settings, group: "Configurações" },
];

export function brl(n: any) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function dataBr(d?: string | null) {
  if (!d) return "—";
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

export function FinKpi({ label, value, tone }: { label: string; value: string; tone?: "verde" | "vermelho" | "ambar" }) {
  const cor = tone === "verde" ? "text-emerald-400" : tone === "vermelho" ? "text-rose-400" : tone === "ambar" ? "text-amber-300" : "text-foreground";
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${cor}`}>{value}</div>
    </div>
  );
}

export function FinStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    pago: "bg-emerald-500/10 text-emerald-300",
    recebido: "bg-emerald-500/10 text-emerald-300",
    acertado: "bg-emerald-500/10 text-emerald-300",
    conciliado: "bg-emerald-500/10 text-emerald-300",
    vencido: "bg-rose-500/10 text-rose-300",
    divergente: "bg-rose-500/10 text-rose-300",
    cancelado: "bg-muted text-muted-foreground",
    estornado: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap ${map[status] ?? "bg-amber-500/10 text-amber-300"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function FinShell({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { setActiveSystem } = useSystem();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  function trocarSistema() {
    setActiveSystem(null);
    navigate({ to: "/launcher" });
  }
  async function sair() {
    setActiveSystem(null);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const grupos = Array.from(new Set(FIN_NAV.map((i) => i.group)));

  const sidebar = (
    <nav className="flex-1 overflow-y-auto thin-scroll px-2 py-3 space-y-3">
      {grupos.map((g) => (
        <div key={g}>
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{g}</p>
          {FIN_NAV.filter((i) => i.group === g).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                style={active ? { background: ACCENT_BG, boxShadow: `inset 2px 0 0 ${FIN_ACCENT}` } : undefined}
              >
                <Icon className="size-4 shrink-0" style={active ? { color: FIN_ACCENT } : undefined} />
                <span className="font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const rodape = (
    <div className="p-3 border-t border-border space-y-1">
      <button onClick={trocarSistema} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5">
        <Grid3x3 className="size-4" /> Trocar Sistema
      </button>
      <button onClick={sair} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/5">
        <LogOut className="size-4" /> Sair
      </button>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden text-foreground" style={{ background: "#0a0a0c" }}>
      <aside className="hidden lg:flex w-60 flex-col border-r border-border shrink-0" style={{ background: "#0f0f12" }}>
        <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
          <PxGrupoLogo onDark height={26} className="shrink-0" />
          <div className="leading-none">
            <div className="text-sm font-semibold">Financeiro</div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">PX Platform</div>
          </div>
        </div>
        {sidebar}
        {rodape}
      </aside>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] flex flex-col border-r border-border" style={{ background: "#0f0f12" }}>
            <div className="h-14 px-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <PxGrupoLogo onDark height={22} />
                <span className="text-sm font-semibold">Financeiro</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 text-muted-foreground"><X className="size-4" /></button>
            </div>
            {sidebar}
            {rodape}
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
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <EmpresaSelector />
            </div>
          </div>
        </header>
        <div className="p-3 sm:p-4 lg:p-6 space-y-4 animate-route-enter">{children}</div>
      </main>
    </div>
  );
}
