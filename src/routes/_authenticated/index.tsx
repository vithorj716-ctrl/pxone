import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  kpiConsolidado,
  performancePorUnidade,
  evolucaoReceita,
  distribuicaoValuation,
  decisoesPendentes,
  alertasRisco,
} from "@/lib/mock-data";
import { formatBRL, formatPct } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "PXOne — Executive Command Center" }] }),
  component: ExecutiveCommandCenter,
});

function ExecutiveCommandCenter() {
  const [empresa, setEmpresa] = useState("consolidado");

  return (
    <AppShell
      title="Executive Command Center"
      headerActions={
        <div className="flex items-center gap-3">
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="bg-surface text-sm text-foreground rounded-md ring-1 ring-border px-3 py-1.5 focus:outline-none focus:ring-brand"
          >
            <option value="consolidado">Grupo PX (Consolidado)</option>
            <option value="pxlog">PXLog Logística</option>
            <option value="pxmed">PXMed Saúde</option>
            <option value="pxfarma">PXFarma</option>
          </select>
          <button className="py-2 px-3 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
            Relatório Trimestral
          </button>
        </div>
      }
      rightPanel={<RightPanel />}
    >
      <KpiGrid />
      <AnalyticsRow />
      <UnitTable />
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaTone = "brand",
  progress,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "brand" | "danger" | "muted";
  progress: number;
}) {
  const toneClasses: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-surface-2 text-muted-foreground",
  };
  const barTone = deltaTone === "danger" ? "bg-destructive" : deltaTone === "muted" ? "bg-muted-foreground/60" : "bg-brand";

  return (
    <div className="p-5 bg-surface ring-1 ring-border rounded-xl space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-medium tracking-tight">{value}</h2>
        {delta && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${toneClasses[deltaTone]}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full ${barTone}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function KpiGrid() {
  const k = kpiConsolidado;
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Receita Bruta" value={formatBRL(k.receita)} delta={formatPct(k.receitaDelta)} progress={78} />
      <KpiCard label="EBITDA Consolidado" value={formatBRL(k.ebitda)} delta={`${k.ebitdaMargem}%`} progress={62} />
      <KpiCard label="Valuation Estimado" value={formatBRL(k.valuation)} delta="Pre-money" deltaTone="muted" progress={90} />
      <KpiCard label="Caixa Livre" value={formatBRL(k.caixa)} delta={formatPct(k.caixaDelta)} deltaTone="danger" progress={45} />
    </section>
  );
}

function AnalyticsRow() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 p-6 bg-surface ring-1 ring-border rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-medium">Projeção de Crescimento vs Realizado</h3>
          <div className="flex gap-4">
            <Legend color="bg-brand" label="Realizado" />
            <Legend color="bg-muted-foreground/60" label="Target LTM" />
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucaoReceita} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.73 0.17 162)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.73 0.17 162)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0 0)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.62 0 0)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.62 0 0)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0 0)",
                  border: "1px solid oklch(0.27 0 0)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "oklch(0.62 0 0)" }}
              />
              <Area type="monotone" dataKey="target" stroke="oklch(0.62 0 0)" strokeDasharray="4 4" fill="transparent" strokeWidth={1.5} />
              <Area type="monotone" dataKey="receita" stroke="oklch(0.73 0.17 162)" fill="url(#gradReceita)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-6 bg-surface ring-1 ring-border rounded-xl flex flex-col">
        <h3 className="text-sm font-medium mb-6">Distribuição de Valuation</h3>
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {distribuicaoValuation.map((item, i) => (
            <div key={item.empresa} className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.empresa}</span>
                <span className="font-medium">
                  {item.pct}% ({formatBRL(item.valor)})
                </span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${item.pct}%`, opacity: 1 - i * 0.3 }}
                />
              </div>
            </div>
          ))}
        </div>
        <button className="mt-6 w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Ver detalhes do Valuation Engine →
        </button>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`size-2 rounded-full ${color}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function UnitTable() {
  const tone: Record<string, string> = {
    baixo: "text-success",
    medio: "text-warning",
    alto: "text-destructive",
  };
  const okrTone: Record<string, { color: string; label: string }> = {
    no_prazo: { color: "bg-brand", label: "No prazo" },
    atraso: { color: "bg-destructive", label: "Atraso crítico" },
  };
  return (
    <section className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-medium">Performance Comparativa por Unidade</h3>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="px-6 py-4 font-medium">Unidade de Negócio</th>
            <th className="px-6 py-4 font-medium">Receita (YTD)</th>
            <th className="px-6 py-4 font-medium">Margem EBITDA</th>
            <th className="px-6 py-4 font-medium">Status OKR</th>
            <th className="px-6 py-4 font-medium text-right">Risco</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {performancePorUnidade.map((row) => (
            <tr key={row.empresa} className="text-sm hover:bg-surface-2/40 transition-colors">
              <td className="px-6 py-4 font-medium">{row.empresa}</td>
              <td className="px-6 py-4 text-muted-foreground">{formatBRL(row.receita)}</td>
              <td className="px-6 py-4 text-muted-foreground">{row.margemEbitda}%</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${okrTone[row.okrStatus].color}`} />
                  <span className="text-xs">{okrTone[row.okrStatus].label}</span>
                </div>
              </td>
              <td className={`px-6 py-4 text-right text-[10px] font-medium uppercase ${tone[row.risco]}`}>
                {row.risco}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RightPanel() {
  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Decisões Pendentes
          </h3>
          <span className="size-5 rounded-full bg-surface-2 flex items-center justify-center text-[10px]">
            {decisoesPendentes.length}
          </span>
        </div>
        <div className="space-y-3">
          {decisoesPendentes.map((d) => (
            <div
              key={d.titulo}
              className={`p-4 bg-surface ring-1 ring-border rounded-lg ${
                d.destaque ? "border-l-2 border-brand" : ""
              }`}
            >
              <p className="text-xs font-medium mb-1">{d.titulo}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mb-3">{d.descricao}</p>
              {d.destaque && (
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 text-[10px] font-medium bg-brand text-brand-foreground rounded">
                    Aprovar
                  </button>
                  <button className="flex-1 py-1.5 text-[10px] font-medium bg-surface-2 text-foreground rounded">
                    Analisar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          AI Analyst Insights
        </h3>
        <div className="p-4 bg-brand/5 ring-1 ring-brand/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-2.5 bg-brand rounded-full animate-pulse" />
            <span className="text-[10px] font-medium text-brand uppercase tracking-wider">
              Análise ativa
            </span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">
            Detectada divergência de 14% no fluxo de caixa da PXFarma vs. Planejamento 1 Ano.
            Recomendado revisar política de recebíveis.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Alertas de Risco
        </h3>
        <div className="space-y-3">
          {alertasRisco.map((a) => (
            <div key={a.titulo} className="flex gap-3">
              <div
                className={`size-1.5 rounded-full shrink-0 mt-1.5 ${
                  a.nivel === "alto" ? "bg-destructive" : "bg-warning"
                }`}
              />
              <div>
                <div className="text-xs font-medium">{a.titulo}</div>
                <p className="text-[10px] text-muted-foreground leading-snug">{a.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
