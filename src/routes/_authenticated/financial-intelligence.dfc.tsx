import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Line, LineChart, Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { loadFinancialData } from "@/lib/financial-intelligence.functions";
import { askFinancialAdvisor } from "@/lib/financial-ai.functions";
import { calcDfc, buildExecutiveSummary, type FinancialData } from "@/lib/financial-intelligence";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financial-intelligence/dfc")({
  component: DFCPage,
});

function DFCPage() {
  const load = useServerFn(loadFinancialData);
  const advisor = useServerFn(askFinancialAdvisor);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ai, setAi] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { (async () => {
    try { setData(await load() as any); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  })(); }, [load]);

  const period = useMemo(() => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }), []);
  const result = useMemo(() => data ? calcDfc(data, period) : null, [data, period]);

  async function runAi() {
    if (!data) return;
    setAiLoading(true);
    try {
      const summary = buildExecutiveSummary(data, period);
      setAi(await advisor({ data: { mode: "dfc", summary } }));
    } catch (e: any) { toast.error(e.message); } finally { setAiLoading(false); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;
  if (!data || !result) return <div className="p-8 text-muted-foreground">Sem dados.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={runAi} disabled={aiLoading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium disabled:opacity-50">
          {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analisar com IA
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Entradas", formatBRL(result.entradas)],
          ["Saídas", formatBRL(result.saidas)],
          ["Fluxo Operacional", formatBRL(result.fluxoOperacional)],
          ["Fluxo Investimento", formatBRL(result.fluxoInvestimento)],
          ["Fluxo Financiamento", formatBRL(result.fluxoFinanciamento)],
          ["Fluxo Livre", formatBRL(result.fluxoLivre)],
          ["Saldo Atual", formatBRL(result.saldoFinal)],
          ["Projeção 90d", formatBRL(result.saldoProjetado90d)],
          ["Capital de Giro", formatBRL(result.capitalGiro)],
          ["Necessidade Caixa", formatBRL(result.necessidadeCaixa)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl p-3 ring-1 ring-border bg-surface/40">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <h3 className="text-sm font-semibold mb-3">Entradas vs Saídas — Mensal</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={result.porMes}>
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatBRL(v)} />
            <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
            <Legend />
            <Bar dataKey="entradas" fill="#10b981" name="Entradas" />
            <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <h3 className="text-sm font-semibold mb-3">Saldo Acumulado</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={result.porMes}>
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatBRL(v)} />
            <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
            <Line type="monotone" dataKey="acumulado" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {ai && (
        <div className="rounded-xl ring-1 ring-brand/40 bg-brand/5 p-5 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="size-4" /> Diagnóstico IA</h3>
          <p className="text-sm">{ai.diagnostico}</p>
          {ai.evidencias?.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {ai.evidencias.map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
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
