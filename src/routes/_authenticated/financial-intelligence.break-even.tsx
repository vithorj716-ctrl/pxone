import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { loadFinancialData } from "@/lib/financial-intelligence.functions";
import { askFinancialAdvisor } from "@/lib/financial-ai.functions";
import { calcBreakEven, buildExecutiveSummary, type FinancialData } from "@/lib/financial-intelligence";
import { formatBRL, formatPct } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financial-intelligence/break-even")({
  component: BreakEvenPage,
});

function BreakEvenPage() {
  const load = useServerFn(loadFinancialData);
  const advisor = useServerFn(askFinancialAdvisor);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sim, setSim] = useState({ precoPct: 0, custosPct: 0, vendasPct: 0, impostosPct: 0, novosColaboradores: 0, custoMedioColab: 5000 });
  const [ai, setAi] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { (async () => {
    try { setData(await load() as any); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  })(); }, [load]);

  const period = useMemo(() => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }), []);

  const baseInputs = useMemo(() => {
    if (!data) return null;
    const fixos = data.custos.filter((c) => c.tipo_custo === "fixo").reduce((a, c) => a + c.valor, 0);
    const variaveis = data.custos.filter((c) => c.tipo_custo === "variavel").reduce((a, c) => a + c.valor, 0);
    const snaps = data.snapshots.filter((s) => new Date(s.periodo) >= period.start);
    const receita = snaps.reduce((a, s) => a + s.receita, 0);
    return { custosFixos: fixos, custosVariaveis: variaveis, receita, markupPct: data.markupMedio };
  }, [data, period]);

  const base = useMemo(() => baseInputs ? calcBreakEven(baseInputs) : null, [baseInputs]);
  const simResult = useMemo(() => baseInputs ? calcBreakEven({ ...baseInputs, ...sim }) : null, [baseInputs, sim]);

  async function runAi() {
    if (!data) return;
    setAiLoading(true);
    try {
      const summary = { ...buildExecutiveSummary(data, period), simulacao: sim, base, simulado: simResult };
      setAi(await advisor({ data: { mode: "break-even", summary, pergunta: "Qual ação gera maior impacto financeiro?" } }));
    } catch (e: any) { toast.error(e.message); } finally { setAiLoading(false); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;
  if (!base || !simResult) return <div className="p-8 text-muted-foreground">Sem dados.</div>;

  const compare = [
    { label: "Receita", atual: base.receita, simulado: simResult.receita },
    { label: "Break-Even", atual: base.peContabil, simulado: simResult.peContabil },
    { label: "Lucro", atual: base.novoLucro, simulado: simResult.novoLucro },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["PE Contábil", formatBRL(base.peContabil)],
          ["PE Financeiro", formatBRL(base.peFinanceiro)],
          ["PE Econômico", formatBRL(base.peEconomico)],
          ["Receita Mínima", formatBRL(base.receitaMinima)],
          ["Margem Contribuição", formatPct(base.margemContribuicaoPct)],
          ["Margem Segurança", formatPct(base.margemSeguranca)],
          ["GAO", base.gao.toFixed(2)],
          ["Dias p/ Equilíbrio", String(base.diasParaEquilibrio)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl p-3 ring-1 ring-border bg-surface/40">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Simulador de Cenários</h3>
          <button onClick={runAi} disabled={aiLoading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium disabled:opacity-50">
            {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} IA: Maior Impacto
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { k: "precoPct" as const, label: "Preço (%)", min: -50, max: 100 },
            { k: "custosPct" as const, label: "Custos (%)", min: -50, max: 100 },
            { k: "vendasPct" as const, label: "Volume vendas (%)", min: -50, max: 200 },
            { k: "impostosPct" as const, label: "Impostos extras (%)", min: 0, max: 50 },
            { k: "novosColaboradores" as const, label: "Novos colab.", min: 0, max: 50 },
            { k: "custoMedioColab" as const, label: "Custo médio colab.", min: 0, max: 50000 },
          ].map((f) => (
            <label key={f.k} className="text-xs space-y-1">
              <span className="text-muted-foreground">{f.label}: <b className="text-foreground">{sim[f.k]}</b></span>
              <input type="range" min={f.min} max={f.max} value={sim[f.k]}
                onChange={(e) => setSim({ ...sim, [f.k]: Number(e.target.value) })}
                className="w-full" />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <h3 className="text-sm font-semibold mb-3">Atual vs Simulado</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={compare}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatBRL(v)} />
            <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
            <Bar dataKey="atual" fill="#94a3b8" name="Atual" />
            <Bar dataKey="simulado" fill="hsl(var(--brand))" name="Simulado" />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {ai && (
        <div className="rounded-xl ring-1 ring-brand/40 bg-brand/5 p-5 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="size-4" /> Análise IA</h3>
          <p className="text-sm">{ai.diagnostico}</p>
          {ai.evidencias?.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4">{ai.evidencias.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
          )}
          <p className="text-xs"><b>Impacto:</b> {ai.impactoFinanceiroEstimado}</p>
          {ai.recomendacoes?.length > 0 && (
            <div className="text-xs"><b>Recomendações:</b>
              <ul className="list-disc pl-4">{ai.recomendacoes.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
