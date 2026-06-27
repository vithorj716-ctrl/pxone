import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { LayoutDashboard, FileBarChart, Waves, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financial-intelligence")({
  head: () => ({ meta: [{ title: "PXOne — Financial Intelligence Suite" }] }),
  component: Layout,
});

type Tab = { to: string; label: string; icon: any; exact?: boolean };
const tabs: Tab[] = [
  { to: "/financial-intelligence", label: "CEO Cockpit", icon: LayoutDashboard, exact: true },
  { to: "/financial-intelligence/dre", label: "DRE Gerencial", icon: FileBarChart },
  { to: "/financial-intelligence/dfc", label: "DFC Inteligente", icon: Waves },
  { to: "/financial-intelligence/break-even", label: "Ponto de Equilíbrio", icon: Scale },
];

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell title="Financial Intelligence Suite" subtitle="Inteligência financeira executiva — submódulo do Markup Engine">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface ring-1 ring-border w-fit overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to as any}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="size-4" /> {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
