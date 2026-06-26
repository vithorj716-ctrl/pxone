import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { analisarCustos } from "@/lib/costs-ai.functions";
import { toast } from "sonner";
import {
  Copy, Plus, Trash2, Send, X, Search, Filter, TrendingUp, TrendingDown,
  Sparkles, BarChart3, List, Calendar, DollarSign, AlertTriangle, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/custos")({
  head: () => ({ meta: [{ title: "PXOne — Central de Custos" }] }),
  component: CentralDeCustos,
});

type TipoCusto = "fixo" | "variavel" | "unico" | "recorrente";

interface Empresa { id: string; codigo: string; nome: string }
interface Categoria { id: string; nome: string }
interface Custo {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  empresa_id: string | null;
  centro_custo: string | null;
  categoria_id: string | null;
  tipo_custo: TipoCusto;
  data: string;
  status: string;
  created_by: string | null;
  created_at?: string;
}

const TIPOS: { value: TipoCusto; label: string }[] = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "unico", label: "Único" },
  { value: "recorrente", label: "Recorrente" },
];

const STATUS_OPTS = ["todos", "pendente", "aprovado", "rejeitado"];

const PERIODOS = [
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "trimestre", label: "Trimestre" },
  { key: "ano", label: "Ano" },
  { key: "tudo", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
] as const;
type PeriodoKey = (typeof PERIODOS)[number]["key"];

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtBRLFull(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtPct(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}
function ymKey(d: string) { return d.slice(0, 7); }

function periodoRange(p: PeriodoKey, custom?: { start: string; end: string }): { start: string; end: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "tudo") return null;
  if (p === "custom" && custom?.start && custom?.end) return custom;
  if (p === "mes") return { start: new Date(y, m, 1).toISOString().slice(0, 10), end: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
  if (p === "mes_passado") return { start: new Date(y, m - 1, 1).toISOString().slice(0, 10), end: new Date(y, m, 0).toISOString().slice(0, 10) };
  if (p === "trimestre") {
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart, 1).toISOString().slice(0, 10), end: new Date(y, qStart + 3, 0).toISOString().slice(0, 10) };
  }
  if (p === "ano") return { start: new Date(y, 0, 1).toISOString().slice(0, 10), end: new Date(y, 11, 31).toISOString().slice(0, 10) };
  return null;
}

function CentralDeCustos() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [exportTarget, setExportTarget] = useState<Custo | null>(null);
  const [detailTarget, setDetailTarget] = useState<Custo | null>(null);
  const [showCategoria, setShowCategoria] = useState(false);
  const [tab, setTab] = useState<"lista" | "analise">("lista");

  // Filtros
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoKey>("mes");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const askAI = useServerFn(analisarCustos);

  async function loadAll() {
    setLoading(true);
    const [e, c, k] = await Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("categorias_custo").select("id,nome").order("nome"),
      supabase.from("custos").select("*").order("data", { ascending: false }),
    ]);
    if (e.data) setEmpresas(e.data);
    if (c.data) setCategorias(c.data);
    if (k.data) setCustos(k.data as Custo[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Aplicar filtros
  const filtered = useMemo(() => {
    const range = periodoRange(periodo, customRange);
    const q = search.trim().toLowerCase();
    const vmin = valorMin ? Number(valorMin.replace(",", ".")) : null;
    const vmax = valorMax ? Number(valorMax.replace(",", ".")) : null;
    return custos.filter((c) => {
      if (range && (c.data < range.start || c.data > range.end)) return false;
      if (filterCategoria !== "todas" && c.categoria_id !== filterCategoria) return false;
      if (filterEmpresa !== "todas" && c.empresa_id !== filterEmpresa) return false;
      if (filterStatus !== "todos" && c.status !== filterStatus) return false;
      if (filterTipo !== "todos" && c.tipo_custo !== filterTipo) return false;
      if (vmin !== null && Number(c.valor) < vmin) return false;
      if (vmax !== null && Number(c.valor) > vmax) return false;
      if (q) {
        const blob = `${c.nome} ${c.descricao ?? ""} ${c.centro_custo ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [custos, periodo, customRange, filterCategoria, filterEmpresa, filterStatus, filterTipo, valorMin, valorMax, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, c) => s + Number(c.valor), 0);
    const aprovados = filtered.filter((c) => c.status === "aprovado").reduce((s, c) => s + Number(c.valor), 0);
    const pendentes = filtered.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor), 0);
    const fixos = filtered.filter((c) => c.tipo_custo === "fixo" || c.tipo_custo === "recorrente").reduce((s, c) => s + Number(c.valor), 0);
    const variaveis = filtered.filter((c) => c.tipo_custo === "variavel" || c.tipo_custo === "unico").reduce((s, c) => s + Number(c.valor), 0);
    const ticket = filtered.length ? total / filtered.length : 0;

    // Comparativo mês a mês (sempre vs período anterior equivalente)
    let variacao = 0;
    if (periodo === "mes" || periodo === "mes_passado") {
      const now = new Date();
      const refM = periodo === "mes" ? now.getMonth() : now.getMonth() - 1;
      const refY = now.getFullYear();
      const prevStart = new Date(refY, refM - 1, 1).toISOString().slice(0, 10);
      const prevEnd = new Date(refY, refM, 0).toISOString().slice(0, 10);
      const prev = custos.filter((c) => c.data >= prevStart && c.data <= prevEnd).reduce((s, c) => s + Number(c.valor), 0);
      if (prev > 0) variacao = ((total - prev) / prev) * 100;
    }

    // Projeção mês corrente
    let projecao = total;
    if (periodo === "mes") {
      const now = new Date();
      const diasDecorridos = now.getDate();
      const diasTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      projecao = diasDecorridos > 0 ? (total / diasDecorridos) * diasTotal : total;
    }

    return { total, aprovados, pendentes, fixos, variaveis, ticket, variacao, projecao };
  }, [filtered, custos, periodo]);

  // Dados para gráficos
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, number>();
    custos.forEach((c) => {
      const k = ymKey(c.data);
      map.set(k, (map.get(k) ?? 0) + Number(c.valor));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, valor]) => ({ mes: mes.slice(2).replace("-", "/"), valor: Math.round(valor) }));
  }, [custos]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => {
      const cat = categorias.find((x) => x.id === c.categoria_id)?.nome ?? "Sem categoria";
      map.set(cat, (map.get(cat) ?? 0) + Number(c.valor));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categorias]);

  const topCentrosCusto = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => {
      const k = c.centro_custo ?? "Não informado";
      map.set(k, (map.get(k) ?? 0) + Number(c.valor));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const fixosVsVariaveis = useMemo(
    () => [
      { name: "Fixos / Recorrentes", value: Math.round(kpis.fixos) },
      { name: "Variáveis / Únicos", value: Math.round(kpis.variaveis) },
    ],
    [kpis],
  );

  async function runAI() {
    setAiLoading(true);
    setAiResult(null);
    try {
      const resumo = {
        periodo,
        total: kpis.total,
        aprovados: kpis.aprovados,
        pendentes: kpis.pendentes,
        fixos: kpis.fixos,
        variaveis: kpis.variaveis,
        ticket_medio: kpis.ticket,
        variacao_pct: kpis.variacao,
        projecao_mes: kpis.projecao,
        qtd_lancamentos: filtered.length,
        top_categorias: porCategoria.slice(0, 8),
        top_centros_custo: topCentrosCusto,
        evolucao_mensal: evolucaoMensal,
      };
      const r: any = await askAI({ data: { resumo } });
      setAiResult(r);
    } catch (e: any) {
      toast.error(e.message ?? "Falha na análise");
    } finally {
      setAiLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("custos").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    loadAll();
  }

  async function removeCusto(id: string) {
    if (!confirm("Excluir este custo?")) return;
    const { error } = await supabase.from("custos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Custo excluído");
    setDetailTarget(null);
    loadAll();
  }

  const activeFiltersCount =
    (filterCategoria !== "todas" ? 1 : 0) +
    (filterEmpresa !== "todas" ? 1 : 0) +
    (filterStatus !== "todos" ? 1 : 0) +
    (filterTipo !== "todos" ? 1 : 0) +
    (valorMin ? 1 : 0) + (valorMax ? 1 : 0);

  return (
    <AppShell
      title="Central de Custos"
      subtitle="Inteligência financeira do Grupo PX"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={runAI}
            disabled={aiLoading || filtered.length === 0}
            className="py-2 px-3 bg-surface ring-1 ring-border text-sm font-medium rounded-md hover:bg-surface-2 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-brand" />}
            Análise IA
          </button>
          <button onClick={() => setShowCategoria(true)}
            className="py-2 px-3 bg-surface ring-1 ring-border text-sm font-medium rounded-md hover:bg-surface-2 transition-colors">
            Categorias
          </button>
          <button onClick={() => setShowForm(true)}
            className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity inline-flex items-center gap-2">
            <Plus className="size-4" /> Novo custo
          </button>
        </div>
      }
    >
      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<DollarSign className="size-4" />} label="Total no período" value={fmtBRL(kpis.total)} />
        <KpiCard
          icon={kpis.variacao >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          label="Variação vs anterior"
          value={kpis.variacao === 0 ? "—" : fmtPct(kpis.variacao)}
          tone={kpis.variacao > 5 ? "danger" : kpis.variacao < -5 ? "brand" : "muted"}
        />
        <KpiCard icon={<Calendar className="size-4" />} label="Projeção do mês" value={fmtBRL(kpis.projecao)} />
        <KpiCard icon={<DollarSign className="size-4" />} label="Ticket médio" value={fmtBRL(kpis.ticket)} />
        <KpiCard icon={<AlertTriangle className="size-4" />} label="Pendente aprovação" value={fmtBRL(kpis.pendentes)} tone="warning" />
        <KpiCard icon={<BarChart3 className="size-4" />} label="Lançamentos" value={filtered.length.toString()} />
      </section>

      {/* Insights IA */}
      {aiResult && (
        <section className="bg-gradient-to-br from-brand/5 via-surface to-surface ring-1 ring-brand/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="size-4 text-brand" /> Análise IA do período
            </h3>
            <button onClick={() => setAiResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          {aiResult.resumo && <p className="text-sm text-foreground/90 leading-relaxed">{aiResult.resumo}</p>}
          {Array.isArray(aiResult.alertas) && aiResult.alertas.length > 0 && (
            <div className="grid md:grid-cols-2 gap-2">
              {aiResult.alertas.map((a: any, i: number) => (
                <div key={i} className="p-3 bg-surface ring-1 ring-border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                      a.prioridade === "Alta" ? "bg-destructive/10 text-destructive"
                      : a.prioridade === "Média" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                      {a.prioridade}
                    </span>
                    <span className="text-xs font-medium">{a.titulo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(aiResult.oportunidades) && aiResult.oportunidades.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Oportunidades</h4>
              <ul className="space-y-1.5">
                {aiResult.oportunidades.map((o: any, i: number) => (
                  <li key={i} className="text-xs"><span className="font-medium">{o.titulo}:</span> <span className="text-muted-foreground">{o.mensagem}</span></li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(aiResult.acoes) && aiResult.acoes.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Próximas ações</h4>
              <ol className="space-y-1 list-decimal list-inside text-xs text-foreground/90">
                {aiResult.acoes.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* Barra de filtros */}
      <section className="bg-surface ring-1 ring-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, descrição, centro de custo..."
              className="input pl-9 w-full"
            />
          </div>
          <div className="flex items-center gap-1 bg-background ring-1 ring-border rounded-md p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${periodo === p.key ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="py-2 px-3 bg-background ring-1 ring-border text-xs font-medium rounded-md hover:bg-surface-2 inline-flex items-center gap-2"
          >
            <Filter className="size-3.5" /> Filtros
            {activeFiltersCount > 0 && (
              <span className="bg-brand text-brand-foreground text-[10px] px-1.5 rounded-full">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        {periodo === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customRange.start} onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })} className="input text-xs" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" value={customRange.end} onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })} className="input text-xs" />
          </div>
        )}

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-border">
            <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="input text-xs">
              <option value="todas">Todas categorias</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} className="input text-xs">
              <option value="todas">Todas empresas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.codigo}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-xs">
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s === "todos" ? "Todos status" : s}</option>)}
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="input text-xs">
              <option value="todos">Todos tipos</option>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input value={valorMin} onChange={(e) => setValorMin(e.target.value)} placeholder="Valor mín" className="input text-xs" />
            <input value={valorMax} onChange={(e) => setValorMax(e.target.value)} placeholder="Valor máx" className="input text-xs" />
          </div>
        )}
      </section>

      {/* Tabs */}
      <section className="flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === "lista"} onClick={() => setTab("lista")} icon={<List className="size-4" />} label="Lançamentos" />
        <TabBtn active={tab === "analise"} onClick={() => setTab("analise")} icon={<BarChart3 className="size-4" />} label="Análise" />
      </section>

      {tab === "lista" ? (
        <section className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">Lançamentos</h3>
            <span className="text-xs text-muted-foreground">{filtered.length} de {custos.length} registro(s)</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhum custo no filtro atual.</p>
              <button onClick={() => setShowForm(true)}
                className="mt-4 py-2 px-3 bg-brand text-brand-foreground text-xs font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2">
                <Plus className="size-3.5" /> Novo custo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-medium">Data</th>
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Empresa</th>
                    <th className="px-6 py-3 font-medium">Categoria</th>
                    <th className="px-6 py-3 font-medium">Tipo</th>
                    <th className="px-6 py-3 font-medium text-right">Valor</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => {
                    const empresa = empresas.find((e) => e.id === c.empresa_id);
                    const cat = categorias.find((x) => x.id === c.categoria_id);
                    const statusColor =
                      c.status === "aprovado" ? "bg-brand/10 text-brand"
                      : c.status === "rejeitado" ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning";
                    return (
                      <tr key={c.id} onClick={() => setDetailTarget(c)}
                        className="text-sm hover:bg-surface-2/60 transition-colors cursor-pointer">
                        <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-3 font-medium">
                          <div>{c.nome}</div>
                          {c.descricao && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.descricao}</div>}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{empresa?.codigo ?? "—"}</td>
                        <td className="px-6 py-3 text-muted-foreground">{cat?.nome ?? "—"}</td>
                        <td className="px-6 py-3 text-muted-foreground capitalize">{c.tipo_custo}</td>
                        <td className="px-6 py-3 text-right font-mono">{fmtBRL(Number(c.valor))}</td>
                        <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                          <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)}
                            className={`text-[10px] px-2 py-1 rounded font-medium ${statusColor} bg-transparent border-none focus:outline-none cursor-pointer`}>
                            <option value="pendente">pendente</option>
                            <option value="aprovado">aprovado</option>
                            <option value="rejeitado">rejeitado</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setExportTarget(c)} title="Exportar"
                            className="p-1.5 text-muted-foreground hover:text-foreground"><Send className="size-4" /></button>
                          <button onClick={() => removeCusto(c.id)} title="Excluir"
                            className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Evolução mensal (12 meses)">
            {evolucaoMensal.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Distribuição por categoria">
            {porCategoria.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top centros de custo">
            {topCentrosCusto.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCentrosCusto} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                  <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Fixos vs Variáveis">
            {fixosVsVariaveis.every((d) => d.value === 0) ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={fixosVsVariaveis} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label={(e: any) => `${e.name}`}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </section>
      )}

      {showForm && <CustoForm empresas={empresas} categorias={categorias} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadAll(); }} />}
      {showCategoria && <CategoriaManager categorias={categorias} onClose={() => { setShowCategoria(false); loadAll(); }} />}
      {exportTarget && <ExportModal custo={exportTarget} onClose={() => setExportTarget(null)} />}
      {detailTarget && (
        <DetailModal
          custo={detailTarget}
          empresas={empresas}
          categorias={categorias}
          allCustos={custos}
          onClose={() => setDetailTarget(null)}
          onDelete={() => removeCusto(detailTarget.id)}
          onExport={() => { setExportTarget(detailTarget); setDetailTarget(null); }}
        />
      )}
    </AppShell>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 border-b-2 transition-colors ${active ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {icon} {label}
    </button>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "brand" | "warning" | "danger" | "muted" }) {
  const toneClass =
    tone === "brand" ? "text-brand"
    : tone === "warning" ? "text-warning"
    : tone === "danger" ? "text-destructive"
    : tone === "muted" ? "text-muted-foreground"
    : "";
  return (
    <div className="p-4 bg-surface ring-1 ring-border rounded-xl">
      <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
        {icon} {label}
      </div>
      <h2 className={`text-xl font-medium tracking-tight mt-2 ${toneClass}`}>{value}</h2>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-5">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">Sem dados no período</div>;
}

function DetailModal({
  custo, empresas, categorias, allCustos, onClose, onDelete, onExport,
}: {
  custo: Custo; empresas: Empresa[]; categorias: Categoria[]; allCustos: Custo[];
  onClose: () => void; onDelete: () => void; onExport: () => void;
}) {
  const empresa = empresas.find((e) => e.id === custo.empresa_id);
  const cat = categorias.find((x) => x.id === custo.categoria_id);

  // Histórico do mesmo "nome" ou mesma categoria — comparativo
  const historico = useMemo(() => {
    const same = allCustos.filter((c) => c.nome.toLowerCase() === custo.nome.toLowerCase() && c.id !== custo.id);
    const map = new Map<string, number>();
    same.forEach((c) => {
      const k = ymKey(c.data);
      map.set(k, (map.get(k) ?? 0) + Number(c.valor));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, valor]) => ({ mes: mes.slice(2).replace("-", "/"), valor: Math.round(valor) }));
  }, [allCustos, custo]);

  return (
    <Modal title={custo.nome} onClose={onClose} wide>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <DetailItem label="Valor" value={fmtBRLFull(Number(custo.valor))} big />
        <DetailItem label="Data" value={new Date(custo.data + "T00:00:00").toLocaleDateString("pt-BR")} />
        <DetailItem label="Status" value={custo.status} />
        <DetailItem label="Empresa" value={empresa?.nome ?? "—"} />
        <DetailItem label="Categoria" value={cat?.nome ?? "—"} />
        <DetailItem label="Centro de custo" value={custo.centro_custo ?? "—"} />
        <DetailItem label="Tipo" value={custo.tipo_custo} />
        <DetailItem label="Criado em" value={custo.created_at ? new Date(custo.created_at).toLocaleDateString("pt-BR") : "—"} />
      </div>

      {custo.descricao && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
          <p className="text-sm text-foreground/90 bg-background ring-1 ring-border rounded-md p-3">{custo.descricao}</p>
        </div>
      )}

      {historico.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Histórico (mesmo nome)</p>
          <div className="bg-background ring-1 ring-border rounded-md p-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onDelete} className="py-2 px-3 text-sm text-destructive hover:bg-destructive/10 rounded-md inline-flex items-center gap-2">
          <Trash2 className="size-4" /> Excluir
        </button>
        <button onClick={onExport} className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2">
          <Send className="size-4" /> Exportar
        </button>
      </div>
    </Modal>
  );
}

function DetailItem({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="bg-background ring-1 ring-border rounded-md p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-1 ${big ? "text-lg font-medium" : "text-sm"} capitalize`}>{value}</p>
    </div>
  );
}

function CustoForm({
  empresas, categorias, onClose, onSaved,
}: {
  empresas: Empresa[]; categorias: Categoria[]; onClose: () => void; onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? "");
  const [centroCusto, setCentroCusto] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>(categorias[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoCusto>("unico");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !valor) return toast.error("Preencha nome e valor");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("custos").insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      valor: Number(valor.replace(",", ".")),
      empresa_id: empresaId || null,
      centro_custo: centroCusto.trim() || null,
      categoria_id: categoriaId || null,
      tipo_custo: tipo,
      data,
      status: "pendente",
      created_by: u.user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Custo cadastrado");
    onSaved();
  }

  return (
    <Modal title="Novo custo" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome do gasto ou investimento">
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className="input" placeholder="Ex: Licença SaaS XPTO" />
        </Field>
        <Field label="Descrição">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="input resize-none" placeholder="Contexto / motivo do gasto" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input required type="text" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))} className="input" placeholder="0,00" />
          </Field>
          <Field label="Data">
            <input required type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa">
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input">
              <option value="">—</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Centro de custo">
            <input value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} className="input" placeholder="Ex: TI / Marketing / Frota" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="input">
              <option value="">—</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Tipo de custo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCusto)} className="input">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="py-2 px-3 text-sm rounded-md hover:bg-surface-2">Cancelar</button>
          <button type="submit" disabled={saving}
            className="py-2 px-4 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoriaManager({ categorias, onClose }: { categorias: Categoria[]; onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [list, setList] = useState(categorias);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("categorias_custo").select("id,nome").order("nome");
    if (data) setList(data);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("categorias_custo").insert({ nome: nome.trim() });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNome("");
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categorias_custo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <Modal title="Categorias" onClose={onClose}>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="input flex-1" placeholder="Nova categoria" />
        <button type="submit" disabled={saving}
          className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
          Adicionar
        </button>
      </form>
      <ul className="divide-y divide-border max-h-80 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span>{c.nome}</span>
            <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </li>
        ))}
        {list.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Nenhuma categoria</li>}
      </ul>
    </Modal>
  );
}

function ExportModal({ custo, onClose }: { custo: Custo; onClose: () => void }) {
  const text = `Solicitação de aprovação – Grupo PX\n\nGasto: ${custo.nome}\nDescrição: ${custo.descricao ?? "—"}\nValor: ${fmtBRLFull(Number(custo.valor))}`;

  async function copy() {
    try { await navigator.clipboard.writeText(text); toast.success("Texto copiado"); }
    catch { toast.error("Não foi possível copiar"); }
  }

  return (
    <Modal title="Exportar para aprovação" onClose={onClose}>
      <p className="text-xs text-muted-foreground mb-3">Texto pronto para envio no WhatsApp dos sócios.</p>
      <pre className="bg-background ring-1 ring-border rounded-md p-4 text-sm whitespace-pre-wrap font-sans">{text}</pre>
      <div className="flex justify-end mt-4">
        <button onClick={copy} className="py-2 px-4 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2">
          <Copy className="size-4" /> Copiar texto
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-surface ring-1 ring-border rounded-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
