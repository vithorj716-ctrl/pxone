import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, PiggyBank, Activity, Target, Wallet, Gauge, ArrowRight,
} from "lucide-react";
import { loadFinancialData } from "@/lib/financial-intelligence.functions";
import { askFinancialAdvisor } from "@/lib/financial-ai.functions";
import {
  calcDre, calcDfc, calcBreakEven, buildExecutiveSummary, type FinancialData,
} from "@/lib/financial-intelligence";
import { formatBRL, formatPct } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/financial-intelligence/")({
  component: Cockpit,
});

type RadarAlert = { titulo: string; motivo: string; impacto: string; prioridade: string; semaforo: "verde" | "amarelo" | "vermelho"; recomendacao: string; link?: string };

function Cockpit() {
  const load = useServerFn(loadFinancialData);
  const advisor = useServerFn(askFinancialAdvisor);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radar, setRadar] = useState<RadarAlert[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);

  // Simulador
  const [simOpen, setSimOpen] = useState(false);
  const [sim, setSim] = useState({ precoPct: 0, custosPct: 0, vendasPct: 0, impostosPct: 0, novosColaboradores: 0, custoMedioColab: 5000 });

  useEffect(() => { (async () => {
    try { setData(await load() as any); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  })(); }, [load]);

  const period = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    return { start, end };
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;
    const dre = calcDre(data, period);
    const dfc = calcDfc(data, period);
    const fixos = data.custos.filter((c) => c.tipo_custo === "fixo").reduce((a, c) => a + c.valor, 0);
    const variaveis = data.custos.filter((c) => c.tipo_custo === "variavel").reduce((a, c) => a + c.valor, 0);
    const be = calcBreakEven({ custosFixos: fixos, custosVariaveis: variaveis, receita: dre.receitaBruta, markupPct: data.markupMedio });
    const beSim = calcBreakEven({ custosFixos: fixos, custosVariaveis: variaveis, receita: dre.receitaBruta, markupPct: data.markupMedio, ...sim });
    return { dre, dfc, be, beSim, fixos, variaveis };
  }, [data, period, sim]);

  async function runRadar() {
    if (!data) return;
    setRadarLoading(true);
    try {
      const summary = buildExecutiveSummary(data, period);
      const r = await advisor({ data: { mode: "radar", summary } }) as any;
      setRadar(r?.alertas ?? []);
    } catch (e: any) { toast.error(e.message); } finally { setRadarLoading(false); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Consolidando dados financeiros…</div>;
  if (!data || !computed) return <div className="p-8 text-muted-foreground">Sem dados financeiros disponíveis.</div>;

  const { dre, dfc, be, beSim } = computed;

  const cards = [
    { label: "Receita", value: formatBRL(dre.receitaBruta), tone: "brand", icon: DollarSign },
    { label: "Lucro Líquido", value: formatBRL(dre.lucroLiquido), tone: dre.lucroLiquido >= 0 ? "ok" : "danger", icon: PiggyBank },
    { label: "EBITDA", value: formatBRL(dre.ebitda), tone: dre.ebitda >= 0 ? "ok" : "danger", icon: Activity },
    { label: "Margem Líquida", value: formatPct(dre.margemLiquida), tone: dre.margemLiquida >= 10 ? "ok" : dre.margemLiquida >= 0 ? "warn" : "danger" },
    { label: "Margem EBITDA", value: formatPct(dre.margemEbitda), tone: dre.margemEbitda >= 15 ? "ok" : "warn" },
    { label: "Margem Bruta", value: formatPct(dre.margemBruta), tone: "muted" },
    { label: "Caixa Atual", value: formatBRL(dfc.saldoFinal), tone: dfc.saldoFinal > 0 ? "ok" : "danger", icon: Wallet },
    { label: "Fluxo Livre", value: formatBRL(dfc.fluxoLivre), tone: dfc.fluxoLivre >= 0 ? "ok" : "danger" },
    { label: "Projeção 90d", value: formatBRL(dfc.saldoProjetado90d), tone: dfc.saldoProjetado90d > 0 ? "ok" : "danger" },
    { label: "Capital de Giro", value: formatBRL(dfc.capitalGiro), tone: "muted" },
    { label: "Markup Médio", value: formatPct(data.markupMedio), tone: "muted", icon: Gauge },
    { label: "Break-Even", value: formatBRL(be.receitaMinima), tone: "muted", icon: Target },
    { label: "Margem Segurança", value: formatPct(be.margemSeguranca), tone: be.margemSeguranca >= 20 ? "ok" : "warn" },
    { label: "ROI", value: formatPct(dre.roi), tone: dre.roi >= 15 ? "ok" : "warn" },
    { label: "ROE", value: formatPct(dre.roe), tone: "muted" },
    { label: "Margem Contribuição", value: formatPct(be.margemContribuicaoPct), tone: "muted" },
  ];

  const toneClass = (t: string) => ({
    brand: "ring-brand/40 bg-brand/5",
    ok: "ring-emerald-500/40 bg-emerald-500/5",
    warn: "ring-amber-500/40 bg-amber-500/5",
    danger: "ring-red-500/40 bg-red-500/5",
    muted: "ring-border bg-surface/40",
  } as any)[t];

  return (
    <div className="space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`rounded-xl p-4 ring-1 ${toneClass(c.tone)}`}>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{c.label}</span>
                {Icon && <Icon className="size-3.5" />}
              </div>
              <div className="text-xl font-semibold mt-1 tabular-nums">{c.value}</div>
            </div>
          );
        })}
      </div>

      {/* Radar Executivo */}
      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> Radar Executivo</h2>
            <p className="text-xs text-muted-foreground">A IA varre seus dados em busca de riscos e oportunidades.</p>
          </div>
          <button onClick={runRadar} disabled={radarLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium disabled:opacity-50">
            {radarLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Analisar com IA
          </button>
        </div>
        {radar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Clique em "Analisar com IA" para gerar o radar.</p>
        ) : (
          <div className="space-y-2">
            {radar.map((a, i) => {
              const sem = a.semaforo === "vermelho" ? "bg-red-500" : a.semaforo === "amarelo" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={i} className="rounded-lg ring-1 ring-border bg-background p-3 flex gap-3">
                  <div className={`w-1 rounded-full ${sem} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{a.titulo}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.prioridade}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.motivo}</p>
                    <p className="text-xs mt-1"><b>Impacto:</b> {a.impacto} · <b>Recomendação:</b> {a.recomendacao}</p>
                    <Link to="/custos" className="text-[11px] text-brand inline-flex items-center gap-1 mt-1">Ver detalhes <ArrowRight className="size-3" /></Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulador Estratégico */}
      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Simulador Estratégico</h2>
          <button onClick={() => setSimOpen((v) => !v)} className="text-xs text-brand">
            {simOpen ? "Recolher" : "Abrir simulador"}
          </button>
        </div>
        {simOpen && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {[
                { k: "precoPct" as const, label: "Preço (%)", min: -50, max: 100 },
                { k: "custosPct" as const, label: "Custos (%)", min: -50, max: 100 },
                { k: "vendasPct" as const, label: "Volume vendas (%)", min: -50, max: 200 },
                { k: "impostosPct" as const, label: "Impostos extras (%)", min: 0, max: 50 },
                { k: "novosColaboradores" as const, label: "Novos colab.", min: 0, max: 50 },
                { k: "custoMedioColab" as const, label: "Custo médio colab. (R$)", min: 0, max: 50000 },
              ].map((f) => (
                <label key={f.k} className="text-xs space-y-1">
                  <span className="text-muted-foreground">{f.label}: <b className="text-foreground">{sim[f.k]}</b></span>
                  <input type="range" min={f.min} max={f.max} value={sim[f.k]}
                    onChange={(e) => setSim({ ...sim, [f.k]: Number(e.target.value) })}
                    className="w-full" />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <SimCard label="Receita Simulada" before={be.receita} after={beSim.receita} />
              <SimCard label="Break-Even" before={be.receitaMinima} after={beSim.receitaMinima} invert />
              <SimCard label="Lucro Projetado" before={be.novoLucro} after={beSim.novoLucro} />
              <SimCard label="Margem Contribuição %" before={be.margemContribuicaoPct} after={beSim.margemContribuicaoPct} isPct />
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">Os ajustes não são gravados no banco. Para salvar como cenário, integre via API <code>saveScenario</code>.</p>
          </>
        )}
      </div>
    </div>
  );
}

function SimCard({ label, before, after, invert, isPct }: { label: string; before: number; after: number; invert?: boolean; isPct?: boolean }) {
  const diff = after - before;
  const positive = invert ? diff < 0 : diff > 0;
  const fmt = (v: number) => isPct ? `${v.toFixed(1)}%` : formatBRL(v);
  return (
    <div className="rounded-lg ring-1 ring-border bg-background p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{fmt(after)}</div>
      <div className={`text-[11px] flex items-center gap-1 ${positive ? "text-emerald-500" : "text-red-500"}`}>
        {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {diff >= 0 ? "+" : ""}{fmt(diff)}
      </div>
    </div>
  );
}
