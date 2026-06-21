import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { businessPlans } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";
import { useState } from "react";

const horizontes = ["Todos", "1 Ano", "3 Anos", "5 Anos", "10 Anos"] as const;

export const Route = createFileRoute("/_authenticated/business-plan")({
  head: () => ({ meta: [{ title: "PXOne — Business Plan Center" }] }),
  component: BusinessPlanCenter,
});

function BusinessPlanCenter() {
  const [filter, setFilter] = useState<(typeof horizontes)[number]>("Todos");
  const plans = businessPlans.filter((p) => filter === "Todos" || p.horizonte === filter);

  const statusLabel: Record<string, { label: string; color: string }> = {
    no_prazo: { label: "No prazo", color: "bg-brand/10 text-brand" },
    planejamento: { label: "Planejamento", color: "bg-chart-2/10 text-chart-2" },
    visao: { label: "Visão de longo prazo", color: "bg-surface-2 text-muted-foreground" },
  };

  return (
    <AppShell
      title="Business Plan Center"
      subtitle="Planejamento estratégico 1 / 3 / 5 / 10 anos"
      headerActions={
        <button className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
          + Novo Plano
        </button>
      }
    >
      {/* Hero summary */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Planos ativos" value={businessPlans.length.toString()} />
        <SummaryCard label="Meta consolidada Receita" value={formatBRL(1_800_000_000)} />
        <SummaryCard label="Meta consolidada EBITDA" value={formatBRL(520_000_000)} />
        <SummaryCard label="Progresso médio" value="27%" tone="brand" />
      </section>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {horizontes.map((h) => (
          <button
            key={h}
            onClick={() => setFilter(h)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              filter === h
                ? "text-foreground border-b-2 border-brand -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <article
            key={plan.titulo}
            className="p-6 bg-surface ring-1 ring-border rounded-xl space-y-5 hover:ring-brand/30 transition-all"
          >
            <header className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand font-medium">
                  Horizonte {plan.horizonte}
                </p>
                <h3 className="text-base font-medium mt-1.5 tracking-tight">{plan.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-1">{plan.empresa}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-1 rounded font-medium ${
                  statusLabel[plan.status].color
                }`}
              >
                {statusLabel[plan.status].label}
              </span>
            </header>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Meta Receita" value={formatBRL(plan.metaReceita)} />
              <Stat label="Meta EBITDA" value={formatBRL(plan.metaEbitda)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso planejado vs realizado</span>
                <span className="font-medium">{plan.progresso}%</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-brand transition-all" style={{ width: `${plan.progresso}%` }} />
              </div>
            </div>

            <footer className="flex items-center justify-between pt-2 border-t border-border">
              <button className="text-xs text-muted-foreground hover:text-foreground">
                Ver metas detalhadas →
              </button>
              <button className="text-xs text-muted-foreground hover:text-foreground">Editar</button>
            </footer>
          </article>
        ))}
      </section>

      {/* Objetivos corporativos */}
      <section className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium">Objetivos corporativos do Grupo</h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { obj: "Tornar-se líder regional em logística farma-saúde integrada", owner: "Conselho", prazo: "2028" },
            { obj: "Atingir EBITDA consolidado de R$ 165M", owner: "CFO Grupo", prazo: "2027" },
            { obj: "Estruturar entrada em fundo de Private Equity", owner: "Sócios", prazo: "2026" },
            { obj: "Expandir PXFarma para 5 estados adicionais", owner: "Diretoria PXFarma", prazo: "2027" },
          ].map((row) => (
            <div key={row.obj} className="px-6 py-4 flex items-center justify-between gap-4">
              <p className="text-sm flex-1">{row.obj}</p>
              <span className="text-xs text-muted-foreground w-32">{row.owner}</span>
              <span className="text-xs font-mono text-foreground">{row.prazo}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div className="p-5 bg-surface ring-1 ring-border rounded-xl">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <h2 className={`text-2xl font-medium tracking-tight mt-2 ${tone === "brand" ? "text-brand" : ""}`}>
        {value}
      </h2>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-background ring-1 ring-border rounded-md">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}
