import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, Sparkles } from "lucide-react";
import { loadFinancialData } from "@/lib/financial-intelligence.functions";
import { askFinancialAdvisor } from "@/lib/financial-ai.functions";
import { calcDre, dreCascade, buildExecutiveSummary, type FinancialData } from "@/lib/financial-intelligence";
import { formatBRL, formatPct } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financial-intelligence/dre")({
  component: DREPage,
});

function DREPage() {
  const load = useServerFn(loadFinancialData);
  const advisor = useServerFn(askFinancialAdvisor);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [ai, setAi] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { (async () => {
    try { setData(await load() as any); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  })(); }, [load]);

  const period = useMemo(() => ({ start: new Date(new Date().getFullYear(), 0, 1), end: new Date() }), []);

  const result = useMemo(() => data ? calcDre(data, period, empresaId || undefined) : null, [data, period, empresaId]);
  const cascade = useMemo(() => result ? dreCascade(result) : [], [result]);

  async function runAi() {
    if (!data) return;
    setAiLoading(true);
    try {
      const summary = buildExecutiveSummary(data, period, empresaId || undefined);
      setAi(await advisor({ data: { mode: "dre", summary } }));
    } catch (e: any) { toast.error(e.message); } finally { setAiLoading(false); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</div>;
  if (!data || !result) return <div className="p-8 text-muted-foreground">Sem dados.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
          className="bg-surface ring-1 ring-border rounded-md px-3 py-2 text-sm">
          <option value="">Todas empresas</option>
          {data.empresas.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nome}</option>)}
        </select>
        <button onClick={runAi} disabled={aiLoading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand text-brand-foreground text-sm font-medium disabled:opacity-50">
          {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analisar com IA
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Receita", formatBRL(result.receitaBruta)],
          ["Lucro Bruto", formatBRL(result.lucroBruto)],
          ["EBITDA", formatBRL(result.ebitda)],
          ["Lucro Líquido", formatBRL(result.lucroLiquido)],
          ["Margem Bruta", formatPct(result.margemBruta)],
          ["Margem EBITDA", formatPct(result.margemEbitda)],
          ["Margem Líquida", formatPct(result.margemLiquida)],
          ["ROI", formatPct(result.roi)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl p-3 ring-1 ring-border bg-surface/40">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <h3 className="text-sm font-semibold mb-3">Waterfall DRE</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={cascade}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={90} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatBRL(v)} />
            <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
            <Bar dataKey="value">
              {cascade.map((c, i) => (
                <Cell key={i} fill={c.type === "total" ? "hsl(var(--brand))" : c.value >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/40 p-5">
        <h3 className="text-sm font-semibold mb-3">DRE Detalhado</h3>
        <table className="w-full text-sm">
          <tbody>
            {cascade.map((c) => (
              <tr key={c.label} className={c.type === "total" ? "font-semibold border-y border-border" : ""}>
                <td className="py-1.5">{c.label}</td>
                <td className="py-1.5 text-right tabular-nums">{formatBRL(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
