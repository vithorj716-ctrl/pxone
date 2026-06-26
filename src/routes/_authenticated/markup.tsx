import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askPricingAI } from "@/lib/markup-ai.functions";
import { calcular, diagnostico, EMPTY_INPUTS, type MarkupInputs, type PricingResult } from "@/lib/pricing-engine";
import { toast } from "sonner";
import {
  Calculator, LayoutDashboard, GitCompare, History, Sparkles, Save, Send,
  Download, Copy, Trash2, AlertTriangle, TrendingUp, DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/markup")({
  head: () => ({ meta: [{ title: "PXOne — Markup Engine" }] }),
  component: MarkupEngine,
});

type Tab = "dashboard" | "calculadora" | "cenarios" | "historico" | "ia";

function fmtBRL(v: number) {
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtPct(v: number) {
  if (!isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}

interface Empresa { id: string; codigo: string; nome: string }
interface Calc {
  id: string; empresa_id: string | null; produto: string; servico: string | null;
  categoria: string | null; centro_custo: string | null; fornecedor: string | null;
  descricao: string | null; inputs: MarkupInputs; resultados: PricingResult;
  preco_sugerido: number | null; margem_desejada: number | null; lucro_desejado: number | null;
  created_at: string; user_id: string;
}

function MarkupEngine() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [custosTotais, setCustosTotais] = useState({ fixos: 0, variaveis: 0 });
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [e, c, k] = await Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("markup_calculations").select("*").order("created_at", { ascending: false }),
      supabase.from("custos").select("valor,tipo_custo"),
    ]);
    if (e.data) setEmpresas(e.data);
    if (c.data) setCalcs(c.data as any);
    if (k.data) {
      const f = k.data.filter((x: any) => x.tipo_custo === "fixo").reduce((a: number, x: any) => a + Number(x.valor || 0), 0);
      const v = k.data.filter((x: any) => x.tipo_custo === "variavel").reduce((a: number, x: any) => a + Number(x.valor || 0), 0);
      setCustosTotais({ fixos: f, variaveis: v });
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "calculadora", label: "Calculadora", icon: Calculator },
    { id: "cenarios", label: "Cenários", icon: GitCompare },
    { id: "historico", label: "Histórico", icon: History },
    { id: "ia", label: "IA Advisor", icon: Sparkles },
  ];

  return (
    <AppShell title="Markup Engine" subtitle="Motor inteligente de precificação">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface ring-1 ring-border w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                active ? "bg-surface-2 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : tab === "dashboard" ? (
        <DashboardTab calcs={calcs} custosTotais={custosTotais} />
      ) : tab === "calculadora" ? (
        <CalculadoraTab empresas={empresas} onSaved={loadAll} />
      ) : tab === "cenarios" ? (
        <CenariosTab />
      ) : tab === "historico" ? (
        <HistoricoTab calcs={calcs} empresas={empresas} onChanged={loadAll} />
      ) : (
        <IATab />
      )}
    </AppShell>
  );
}

/* ---------------- DASHBOARD ---------------- */
function DashboardTab({ calcs, custosTotais }: { calcs: Calc[]; custosTotais: { fixos: number; variaveis: number } }) {
  const stats = useMemo(() => {
    const rs = calcs.map(c => c.resultados).filter(Boolean) as PricingResult[];
    const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const markups = rs.map(r => r.markupPct);
    const margens = rs.map(r => r.margemPct);
    const receita = rs.reduce((a, r) => a + r.precoSugerido, 0);
    const lucroLiq = rs.reduce((a, r) => a + r.lucroLiquido, 0);
    const lucroBruto = rs.reduce((a, r) => a + r.lucroBruto, 0);
    const prejuizo = calcs.filter(c => (c.resultados?.lucroLiquido ?? 0) < 0);
    const abaixoMargem = calcs.filter(c => (c.resultados?.margemPct ?? 0) < 10 && (c.resultados?.margemPct ?? 0) >= 0);
    const topLucro = [...calcs].sort((a, b) => (b.resultados?.lucroLiquido ?? 0) - (a.resultados?.lucroLiquido ?? 0)).slice(0, 5);
    return { markupMedio: avg(markups), margemMedia: avg(margens), receita, lucroLiq, lucroBruto, prejuizo, abaixoMargem, topLucro };
  }, [calcs]);

  const cards = [
    { label: "Markup médio", value: fmtPct(stats.markupMedio), icon: TrendingUp },
    { label: "Margem média", value: fmtPct(stats.margemMedia), icon: TrendingUp },
    { label: "Receita estimada", value: fmtBRL(stats.receita), icon: DollarSign },
    { label: "Lucro líquido", value: fmtBRL(stats.lucroLiq), icon: DollarSign },
    { label: "Lucro bruto", value: fmtBRL(stats.lucroBruto), icon: DollarSign },
    { label: "Custos fixos", value: fmtBRL(custosTotais.fixos), icon: DollarSign },
    { label: "Custos variáveis", value: fmtBRL(custosTotais.variaveis), icon: DollarSign },
    { label: "Produtos em prejuízo", value: String(stats.prejuizo.length), icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="rounded-xl bg-surface ring-1 ring-border p-4 hover-lift">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Icon className="size-3" /> {c.label}
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Top 5 produtos mais lucrativos">
          {stats.topLucro.length === 0 ? (
            <Empty msg="Sem cálculos salvos." />
          ) : stats.topLucro.map(c => (
            <Row key={c.id} a={c.produto} b={fmtBRL(c.resultados?.lucroLiquido ?? 0)} c={fmtPct(c.resultados?.margemPct ?? 0)} />
          ))}
        </Panel>
        <Panel title="Produtos abaixo da margem ideal (<10%)">
          {stats.abaixoMargem.length === 0 ? <Empty msg="Tudo dentro da meta." /> : stats.abaixoMargem.slice(0, 8).map(c => (
            <Row key={c.id} a={c.produto} b={fmtPct(c.resultados?.margemPct ?? 0)} c={fmtBRL(c.resultados?.precoSugerido ?? 0)} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/60 last:border-0">
      <span className="truncate">{a}</span>
      <span className="tabular-nums font-medium">{b}</span>
      <span className="tabular-nums text-muted-foreground text-xs">{c}</span>
    </div>
  );
}
function Empty({ msg }: { msg: string }) { return <div className="text-xs text-muted-foreground py-2">{msg}</div>; }

/* ---------------- CALCULADORA ---------------- */
const FIELDS: { key: keyof MarkupInputs; label: string; pct?: boolean }[] = [
  { key: "custoCompra", label: "Custo de compra" },
  { key: "frete", label: "Frete" },
  { key: "seguro", label: "Seguro" },
  { key: "ipi", label: "IPI (R$)" },
  { key: "icmsPct", label: "ICMS %", pct: true },
  { key: "pisPct", label: "PIS %", pct: true },
  { key: "cofinsPct", label: "COFINS %", pct: true },
  { key: "issPct", label: "ISS %", pct: true },
  { key: "comissaoPct", label: "Comissão %", pct: true },
  { key: "taxaCartaoPct", label: "Taxa cartão %", pct: true },
  { key: "taxaBancariaPct", label: "Taxa bancária %", pct: true },
  { key: "marketplacePct", label: "Marketplace %", pct: true },
  { key: "despAdmin", label: "Desp. administrativas" },
  { key: "despOperacional", label: "Desp. operacionais" },
  { key: "marketing", label: "Marketing" },
  { key: "despFinanceira", label: "Desp. financeiras" },
  { key: "custosIndiretos", label: "Custos indiretos" },
  { key: "perdasPct", label: "Perdas %", pct: true },
  { key: "lucroDesejadoPct", label: "Lucro desejado %", pct: true },
  { key: "margemDesejadaPct", label: "Margem desejada %", pct: true },
];

function CalculadoraTab({ empresas, onSaved }: { empresas: Empresa[]; onSaved: () => void }) {
  const [inputs, setInputs] = useState<MarkupInputs>(EMPTY_INPUTS);
  const [meta, setMeta] = useState({ empresa_id: "", produto: "", servico: "", categoria: "", centro_custo: "", fornecedor: "", descricao: "" });

  const r = useMemo(() => calcular(inputs), [inputs]);
  const diag = useMemo(() => diagnostico(r), [r]);

  function set<K extends keyof MarkupInputs>(k: K, v: number) {
    setInputs(prev => ({ ...prev, [k]: isFinite(v) ? v : 0 }));
  }

  async function salvar() {
    if (!meta.produto.trim()) { toast.error("Informe o produto/serviço."); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão expirada."); return; }
    const { error } = await supabase.from("markup_calculations").insert({
      user_id: u.user.id,
      empresa_id: meta.empresa_id || null,
      produto: meta.produto,
      servico: meta.servico || null,
      categoria: meta.categoria || null,
      centro_custo: meta.centro_custo || null,
      fornecedor: meta.fornecedor || null,
      descricao: meta.descricao || null,
      inputs: inputs as any,
      resultados: r as any,
      lucro_desejado: inputs.lucroDesejadoPct,
      margem_desejada: inputs.margemDesejadaPct,
      preco_sugerido: r.precoSugerido,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cálculo salvo.");
    onSaved();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 animate-fade-in">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface ring-1 ring-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Identificação</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Empresa">
              <select value={meta.empresa_id} onChange={e => setMeta({ ...meta, empresa_id: e.target.value })}
                className="w-full bg-surface-2 ring-1 ring-border rounded-md px-2 py-1.5 text-sm outline-none focus:ring-brand">
                <option value="">—</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.codigo} · {e.nome}</option>)}
              </select>
            </Field>
            <Field label="Produto"><Inp v={meta.produto} on={v => setMeta({ ...meta, produto: v })} /></Field>
            <Field label="Serviço"><Inp v={meta.servico} on={v => setMeta({ ...meta, servico: v })} /></Field>
            <Field label="Categoria"><Inp v={meta.categoria} on={v => setMeta({ ...meta, categoria: v })} /></Field>
            <Field label="Centro de custo"><Inp v={meta.centro_custo} on={v => setMeta({ ...meta, centro_custo: v })} /></Field>
            <Field label="Fornecedor"><Inp v={meta.fornecedor} on={v => setMeta({ ...meta, fornecedor: v })} /></Field>
            <div className="md:col-span-3">
              <Field label="Descrição"><Inp v={meta.descricao} on={v => setMeta({ ...meta, descricao: v })} /></Field>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface ring-1 ring-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Custos, impostos e despesas</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {FIELDS.map(f => (
              <Field key={f.key} label={f.label + (f.pct ? "" : " (R$)")}>
                <NumberInput value={inputs[f.key]} onChange={v => set(f.key, v)} />
              </Field>
            ))}
          </div>
        </div>

        <button onClick={salvar}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover-lift">
          <Save className="size-4" /> Salvar cálculo
        </button>
      </div>

      {/* Painel resultados em tempo real */}
      <div className="space-y-3 lg:sticky lg:top-20 self-start">
        <ResultBig label="Preço sugerido" value={fmtBRL(r.precoSugerido)} highlight />
        <div className="grid grid-cols-2 gap-2">
          <ResultSmall label="Mínimo" value={fmtBRL(r.precoMinimo)} />
          <ResultSmall label="Ideal" value={fmtBRL(r.precoIdeal)} />
          <ResultSmall label="Premium" value={fmtBRL(r.precoPremium)} />
          <ResultSmall label="Competitivo" value={fmtBRL(r.precoCompetitivo)} />
          <ResultSmall label="Psicológico" value={fmtBRL(r.precoPsicologico)} />
          <ResultSmall label="Máximo" value={fmtBRL(r.precoMaximo)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ResultSmall label="Markup" value={fmtPct(r.markupPct)} />
          <ResultSmall label="Margem" value={fmtPct(r.margemPct)} />
          <ResultSmall label="M. Contribuição" value={fmtPct(r.margemContribuicaoPct)} />
          <ResultSmall label="ROI" value={fmtPct(r.roiPct)} />
          <ResultSmall label="Lucro Bruto" value={fmtBRL(r.lucroBruto)} />
          <ResultSmall label="Lucro Líquido" value={fmtBRL(r.lucroLiquido)} />
          <ResultSmall label="CMV" value={fmtBRL(r.cmv)} />
          <ResultSmall label="Break-even" value={fmtBRL(r.breakEven)} />
        </div>
        {diag.length > 0 && (
          <div className="rounded-xl bg-surface ring-1 ring-border p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Diagnóstico</div>
            {diag.map((d, i) => (
              <div key={i} className={`text-xs flex items-start gap-2 ${
                d.nivel === "critico" ? "text-red-400" : d.nivel === "alerta" ? "text-amber-400" : "text-emerald-400"
              }`}>
                <AlertTriangle className="size-3 mt-0.5 shrink-0" /> {d.texto}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
function Inp({ v, on }: { v: string; on: (v: string) => void }) {
  return <input value={v} onChange={e => on(e.target.value)} className="w-full bg-surface-2 ring-1 ring-border rounded-md px-2 py-1.5 text-sm outline-none focus:ring-brand" />;
}
function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setTxt(value === 0 ? "" : String(value)); }, [value]);
  return (
    <input
      type="text" inputMode="decimal" value={txt}
      onChange={e => {
        const s = e.target.value.replace(",", ".");
        setTxt(e.target.value);
        const n = parseFloat(s);
        onChange(isNaN(n) ? 0 : n);
      }}
      className="w-full bg-surface-2 ring-1 ring-border rounded-md px-2 py-1.5 text-sm tabular-nums outline-none focus:ring-brand"
    />
  );
}
function ResultBig({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ring-1 ${highlight ? "bg-brand/10 ring-brand/40" : "bg-surface ring-border"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function ResultSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2.5 bg-surface ring-1 ring-border">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

/* ---------------- CENÁRIOS ---------------- */
function CenariosTab() {
  const [base, setBase] = useState<MarkupInputs>({ ...EMPTY_INPUTS, custoCompra: 100, icmsPct: 18, comissaoPct: 5, lucroDesejadoPct: 25, margemDesejadaPct: 30 });
  const [delta, setDelta] = useState<MarkupInputs>(base);
  useEffect(() => { setDelta(base); }, [base]);

  const r1 = useMemo(() => calcular(base), [base]);
  const r2 = useMemo(() => calcular(delta), [delta]);

  function applyScenario(fn: (i: MarkupInputs) => MarkupInputs) { setDelta(fn(base)); }

  const presets = [
    { label: "Frete +15%", fn: (i: MarkupInputs) => ({ ...i, frete: i.frete * 1.15 || 15 }) },
    { label: "ICMS +3pp", fn: (i: MarkupInputs) => ({ ...i, icmsPct: i.icmsPct + 3 }) },
    { label: "Comissão +2pp", fn: (i: MarkupInputs) => ({ ...i, comissaoPct: i.comissaoPct + 2 }) },
    { label: "Fornecedor +10%", fn: (i: MarkupInputs) => ({ ...i, custoCompra: i.custoCompra * 1.10 }) },
    { label: "Margem desejada -5pp", fn: (i: MarkupInputs) => ({ ...i, margemDesejadaPct: Math.max(0, i.margemDesejadaPct - 5) }) },
    { label: "Custo geral +5%", fn: (i: MarkupInputs) => ({ ...i, custoCompra: i.custoCompra * 1.05, despAdmin: i.despAdmin * 1.05, despOperacional: i.despOperacional * 1.05 }) },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl bg-surface ring-1 ring-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Cenário base</h3>
        <div className="grid md:grid-cols-4 gap-3">
          {(["custoCompra", "frete", "icmsPct", "comissaoPct", "marketing", "lucroDesejadoPct", "margemDesejadaPct", "despAdmin"] as (keyof MarkupInputs)[]).map(k => (
            <Field key={k} label={k}><NumberInput value={base[k]} onChange={v => setBase({ ...base, [k]: v })} /></Field>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p.label} onClick={() => applyScenario(p.fn)}
            className="px-3 py-1.5 rounded-md bg-surface ring-1 ring-border text-xs hover-lift">{p.label}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <ScenarioCol title="Antes" r={r1} />
        <ScenarioCol title="Depois" r={r2} />
        <div className="rounded-xl bg-surface ring-1 ring-border p-4">
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Diferença</h4>
          {[
            ["Preço sugerido", r2.precoSugerido - r1.precoSugerido, true],
            ["Lucro líquido", r2.lucroLiquido - r1.lucroLiquido, true],
            ["Margem (pp)", r2.margemPct - r1.margemPct, false],
            ["Markup (pp)", r2.markupPct - r1.markupPct, false],
            ["ROI (pp)", r2.roiPct - r1.roiPct, false],
          ].map(([label, val, brl]) => {
            const v = val as number;
            const positive = v >= 0;
            return (
              <div key={label as string} className="flex items-center justify-between text-sm py-1.5 border-b border-border/60 last:border-0">
                <span>{label as string}</span>
                <span className={`tabular-nums font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
                  {positive ? "+" : ""}{brl ? fmtBRL(v) : v.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function ScenarioCol({ title, r }: { title: string; r: PricingResult }) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-border p-4 space-y-1.5">
      <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</h4>
      <Row a="Preço sugerido" b={fmtBRL(r.precoSugerido)} c="" />
      <Row a="Lucro líquido" b={fmtBRL(r.lucroLiquido)} c="" />
      <Row a="Margem" b={fmtPct(r.margemPct)} c="" />
      <Row a="Markup" b={fmtPct(r.markupPct)} c="" />
      <Row a="ROI" b={fmtPct(r.roiPct)} c="" />
    </div>
  );
}

/* ---------------- HISTÓRICO ---------------- */
function HistoricoTab({ calcs, empresas, onChanged }: { calcs: Calc[]; empresas: Empresa[]; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [empresaF, setEmpresaF] = useState("");
  const filtered = useMemo(() => calcs.filter(c =>
    (!q || (c.produto + " " + (c.categoria || "") + " " + (c.fornecedor || "")).toLowerCase().includes(q.toLowerCase())) &&
    (!empresaF || c.empresa_id === empresaF)
  ), [calcs, q, empresaF]);

  async function dup(c: Calc) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("markup_calculations").insert({
      user_id: u.user.id, empresa_id: c.empresa_id, produto: c.produto + " (cópia)", servico: c.servico,
      categoria: c.categoria, centro_custo: c.centro_custo, fornecedor: c.fornecedor, descricao: c.descricao,
      inputs: c.inputs as any, resultados: c.resultados as any,
      lucro_desejado: c.lucro_desejado, margem_desejada: c.margem_desejada, preco_sugerido: c.preco_sugerido,
    });
    if (error) toast.error(error.message); else { toast.success("Duplicado."); onChanged(); }
  }
  async function del(c: Calc) {
    if (!confirm(`Excluir cálculo "${c.produto}"?`)) return;
    const { error } = await supabase.from("markup_calculations").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Excluído."); onChanged(); }
  }
  function exportCSV() {
    const head = ["data", "empresa", "produto", "categoria", "centro_custo", "fornecedor", "preco_sugerido", "margem_pct", "markup_pct", "lucro_liquido"];
    const rows = filtered.map(c => [
      new Date(c.created_at).toLocaleString("pt-BR"),
      empresas.find(e => e.id === c.empresa_id)?.codigo ?? "",
      c.produto, c.categoria ?? "", c.centro_custo ?? "", c.fornecedor ?? "",
      String(c.preco_sugerido ?? ""), String(c.resultados?.margemPct ?? ""), String(c.resultados?.markupPct ?? ""), String(c.resultados?.lucroLiquido ?? ""),
    ]);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `markup-historico-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Buscar produto/categoria/fornecedor" value={q} onChange={e => setQ(e.target.value)}
          className="flex-1 min-w-[200px] bg-surface ring-1 ring-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-brand" />
        <select value={empresaF} onChange={e => setEmpresaF(e.target.value)}
          className="bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm outline-none">
          <option value="">Todas empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.codigo}</option>)}
        </select>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface ring-1 ring-border text-xs hover-lift">
          <Download className="size-3.5" /> CSV
        </button>
      </div>
      <div className="rounded-xl bg-surface ring-1 ring-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Data</th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-left px-3 py-2">Empresa</th>
              <th className="text-right px-3 py-2">Preço</th>
              <th className="text-right px-3 py-2">Margem</th>
              <th className="text-right px-3 py-2">Lucro</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs">Sem cálculos.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-t border-border/60 hover:bg-surface-2/40">
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2">{c.produto}</td>
                <td className="px-3 py-2 text-xs">{empresas.find(e => e.id === c.empresa_id)?.codigo ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(c.preco_sugerido ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(c.resultados?.margemPct ?? 0)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${(c.resultados?.lucroLiquido ?? 0) < 0 ? "text-red-400" : ""}`}>{fmtBRL(c.resultados?.lucroLiquido ?? 0)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => dup(c)} title="Duplicar" className="p-1 text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
                  <button onClick={() => del(c)} title="Excluir" className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="size-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- IA ---------------- */
function IATab() {
  const [q, setQ] = useState("");
  const [hist, setHist] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askPricingAI);

  const sugestoes = [
    "Estou cobrando pouco nos meus produtos?",
    "Qual produto gera mais lucro?",
    "Meu markup médio está saudável?",
    "Quais despesas estão destruindo minha margem?",
    "Se eu reduzir o preço em 5%, quanto lucro perco?",
  ];

  async function send(text?: string) {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setBusy(true); setQ("");
    const newHist = [...hist, { role: "user" as const, content: question }];
    setHist(newHist);
    try {
      const { answer } = await ask({ data: { question, history: hist } });
      setHist([...newHist, { role: "assistant", content: answer }]);
    } catch (e: any) {
      setHist([...newHist, { role: "assistant", content: `⚠ ${e?.message || "Erro"}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4 animate-fade-in">
      <div className="rounded-xl bg-surface ring-1 ring-border flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-3">
          {hist.length === 0 && <div className="text-xs text-muted-foreground">Pergunte algo sobre seus preços. A IA usa apenas indicadores agregados (consumo mínimo de tokens).</div>}
          {hist.map((m, i) => (
            <div key={i} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
              m.role === "user" ? "ml-auto bg-brand/15 ring-1 ring-brand/30" : "bg-surface-2 ring-1 ring-border"
            }`}>{m.content}</div>
          ))}
          {busy && <div className="text-xs text-muted-foreground">Analisando…</div>}
        </div>
        <div className="border-t border-border p-3 flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Faça uma pergunta de pricing…"
            className="flex-1 bg-surface-2 ring-1 ring-border rounded-md px-3 py-2 text-sm outline-none focus:ring-brand" />
          <button onClick={() => send()} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-brand text-brand-foreground text-sm disabled:opacity-50">
            <Send className="size-3.5" /> Enviar
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sugestões</div>
        {sugestoes.map(s => (
          <button key={s} onClick={() => send(s)}
            className="w-full text-left text-xs px-3 py-2 rounded-md bg-surface ring-1 ring-border hover:bg-surface-2 transition-colors">{s}</button>
        ))}
      </div>
    </div>
  );
}
