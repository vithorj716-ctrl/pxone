import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Wallet, ShieldAlert, TrendingUp, Goal, Gavel,
  CheckCircle2, Clock, ArrowUpRight, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "PXOne — Executive Command Center" }] }),
  component: ExecutiveCommandCenter,
});

interface Custo { valor: number; status: string; empresa_id: string | null; tipo_custo: string }
interface Empresa { id: string; codigo: string; nome: string }

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function ExecutiveCommandCenter() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [counts, setCounts] = useState({ riscos: 0, kpis: 0, decisoes: 0, okrs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("custos").select("valor,status,empresa_id,tipo_custo"),
      supabase.from("risks").select("id", { count: "exact", head: true }),
      supabase.from("kpis").select("id", { count: "exact", head: true }),
      supabase.from("decisions").select("id", { count: "exact", head: true }),
      supabase.from("okrs").select("id", { count: "exact", head: true }),
    ]).then(([e, c, r, k, d, o]) => {
      if (e.data) setEmpresas(e.data);
      if (c.data) setCustos(c.data as Custo[]);
      setCounts({
        riscos: r.count ?? 0,
        kpis: k.count ?? 0,
        decisoes: d.count ?? 0,
        okrs: o.count ?? 0,
      });
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    const total = custos.reduce((s, c) => s + Number(c.valor || 0), 0);
    const pend = custos.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const apr = custos.filter((c) => c.status === "aprovado").reduce((s, c) => s + Number(c.valor || 0), 0);
    return { total, pend, apr };
  }, [custos]);

  const porEmpresa = useMemo(() => {
    return empresas.map((e) => {
      const valor = custos.filter((c) => c.empresa_id === e.id).reduce((s, c) => s + Number(c.valor || 0), 0);
      return { codigo: e.codigo, nome: e.nome, valor };
    });
  }, [empresas, custos]);

  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    custos.forEach((c) => map.set(c.tipo_custo, (map.get(c.tipo_custo) ?? 0) + Number(c.valor || 0)));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [custos]);

  const PIE_COLORS = ["var(--brand)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <AppShell
      title="Executive Command Center"
      subtitle="Visão consolidada — dados reais do grupo"
    >
      {/* Hero */}
      <section className="rounded-2xl ring-1 ring-border surface-animated p-6 md:p-8 animate-fade-in-up overflow-hidden relative">
        <div className="absolute -top-12 -right-12 size-48 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-brand)" }} />
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-brand" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-brand font-medium">Grupo PX</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight">
          Bem-vindo ao <span className="text-gradient-brand">PXOne</span>.
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Cérebro estratégico de PXLog, PXMed e PXFarma. Indicadores nascem do que você cadastra — comece pela
          {" "}<Link to="/custos" className="text-brand hover:underline">Central de Custos</Link> ou pelo{" "}
          <Link to="/ai-analyst" className="text-brand hover:underline">Conselheiro IA</Link>.
        </p>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Empresas" value={empresas.length.toString()} to="/empresas" tone="brand" delay={1} />
        <KpiCard icon={Wallet} label="Lançamentos" value={custos.length.toString()} to="/custos" delay={2} />
        <KpiCard icon={Clock} label="A aprovar" value={fmtBRL(totals.pend)} to="/custos" tone="warning" delay={3} />
        <KpiCard icon={CheckCircle2} label="Aprovados" value={fmtBRL(totals.apr)} to="/custos" tone="success" delay={4} />
      </section>

      {/* Governance grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard icon={Goal} label="KPIs cadastrados" value={counts.kpis} to="/kpis" />
        <MiniCard icon={ShieldAlert} label="Riscos mapeados" value={counts.riscos} to="/risk" />
        <MiniCard icon={Gavel} label="Decisões" value={counts.decisoes} to="/decisions" />
        <MiniCard icon={TrendingUp} label="OKRs ativos" value={counts.okrs} to="/okr" />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface ring-1 ring-border rounded-xl p-5 hover-lift animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Custos por empresa</h3>
              <p className="text-[11px] text-muted-foreground">Consolidação real do banco de dados</p>
            </div>
            <Link to="/custos" className="text-[11px] text-muted-foreground hover:text-brand inline-flex items-center gap-1">
              Detalhar <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {loading ? (
            <div className="h-56 skeleton" />
          ) : porEmpresa.length === 0 || porEmpresa.every((p) => p.valor === 0) ? (
            <EmptyChart text="Cadastre empresas e custos para visualizar consolidação." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porEmpresa} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="codigo" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtBRL(Number(v))} width={80} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(v: any) => [fmtBRL(Number(v)), "Custos"]}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {porEmpresa.map((_, i) => (
                      <Cell key={i} fill="var(--brand)" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-surface ring-1 ring-border rounded-xl p-5 hover-lift animate-fade-in-up stagger-3">
          <h3 className="text-sm font-semibold mb-1">Distribuição por tipo</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Fixo, variável, único, recorrente</p>
          {loading ? (
            <div className="h-56 skeleton" />
          ) : porTipo.length === 0 ? (
            <EmptyChart text="Sem custos cadastrados." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porTipo} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {porTipo.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any, n: any) => [fmtBRL(Number(v)), String(n)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {porTipo.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="size-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function KpiCard({
  icon: Icon, label, value, to, tone, delay = 0,
}: {
  icon: any; label: string; value: string; to: string;
  tone?: "brand" | "warning" | "success"; delay?: number;
}) {
  const accent =
    tone === "warning" ? "text-warning"
    : tone === "brand" ? "text-brand"
    : tone === "success" ? "text-brand"
    : "text-foreground";
  return (
    <Link
      to={to}
      className={`group p-4 bg-surface ring-1 ring-border rounded-xl hover-lift block animate-fade-in-up stagger-${delay}`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`size-4 ${accent}`} />
        <ArrowUpRight className="size-3.5 text-muted-foreground/40 group-hover:text-brand transition-colors" />
      </div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">{label}</p>
      <h2 className={`text-xl md:text-2xl font-semibold tracking-tight mt-1 tabular-nums ${accent}`}>{value}</h2>
    </Link>
  );
}

function MiniCard({ icon: Icon, label, value, to }: { icon: any; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 p-3 bg-surface ring-1 ring-border rounded-xl hover:ring-brand/40 transition-colors animate-fade-in">
      <div className="size-9 rounded-lg bg-surface-2 flex items-center justify-center group-hover:bg-brand/10 transition-colors">
        <Icon className="size-4 text-muted-foreground group-hover:text-brand transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold tabular-nums">{value}</p>
      </div>
    </Link>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-56 flex items-center justify-center text-center text-xs text-muted-foreground px-6">
      {text}
    </div>
  );
}
