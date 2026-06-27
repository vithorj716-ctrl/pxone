import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Trophy, TrendingDown, Wallet, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/consolidado")({
  head: () => ({ meta: [{ title: "PX Platform — Visão Consolidada" }] }),
  component: ConsolidadoPage,
});

type CustoRow = { empresa_id: string | null; valor: number | null; tipo_custo: string | null };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function ConsolidadoPage() {
  const { empresas, isGrupo, empresa, setEmpresa } = useEmpresaAtiva();
  const [custos, setCustos] = useState<CustoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("custos").select("empresa_id, valor, tipo_custo");
      setCustos(((data as unknown) ?? []) as CustoRow[]);
      setLoading(false);
    })();
  }, []);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { total: number; recorrente: number; unico: number; count: number }>();
    for (const row of custos) {
      const key = row.empresa_id || "sem-empresa";
      const cur = map.get(key) ?? { total: 0, recorrente: 0, unico: 0, count: 0 };
      const v = Number(row.valor || 0);
      cur.total += v;
      cur.count += 1;
      if (row.tipo_custo === "recorrente") cur.recorrente += v;
      else cur.unico += v;
      map.set(key, cur);
    }
    return empresas.map((e) => {
      const m = map.get(e.id) ?? { total: 0, recorrente: 0, unico: 0, count: 0 };
      return {
        id: e.id,
        nome: e.nome_fantasia || e.nome,
        cor: e.cor_primaria || "#3B82F6",
        segmento: e.segmento,
        ...m,
      };
    });
  }, [custos, empresas]);

  const totals = useMemo(() => {
    const total = porEmpresa.reduce((a, b) => a + b.total, 0);
    const recorrente = porEmpresa.reduce((a, b) => a + b.recorrente, 0);
    const count = porEmpresa.reduce((a, b) => a + b.count, 0);
    return { total, recorrente, count };
  }, [porEmpresa]);

  const ranking = useMemo(
    () => [...porEmpresa].sort((a, b) => b.total - a.total),
    [porEmpresa],
  );

  return (
    <AppShell
      title="Visão Consolidada"
      subtitle={isGrupo ? "Grupo PX — todas as empresas" : `Filtrado: ${empresa?.nome_fantasia || empresa?.nome}`}
      headerActions={
        <div className="hidden sm:flex items-center gap-1 text-[10px] rounded-md ring-1 ring-border overflow-hidden">
          <button
            onClick={() => setEmpresa(null)}
            className={`px-2 py-1 ${isGrupo ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
          >
            Consolidado
          </button>
          <button
            onClick={() => empresas[0] && setEmpresa(empresas[0].id)}
            className={`px-2 py-1 ${!isGrupo ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
          >
            Por empresa
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Wallet className="size-4" />} label="Custos totais" value={brl(totals.total)} />
        <KpiCard icon={<TrendingDown className="size-4" />} label="Recorrentes" value={brl(totals.recorrente)} />
        <KpiCard icon={<Layers className="size-4" />} label="Empresas" value={String(empresas.length)} />
        <KpiCard icon={<Building2 className="size-4" />} label="Lançamentos" value={String(totals.count)} />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">Ranking por volume de custos</h2>
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Carregando…</div>
        ) : ranking.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados.</div>
        ) : (
          <div className="space-y-2">
            {ranking.map((r, idx) => {
              const pct = totals.total > 0 ? (r.total / totals.total) * 100 : 0;
              return (
                <div key={r.id} className="flex items-center gap-3 text-xs">
                  <div className="w-5 text-center text-muted-foreground font-mono">{idx + 1}</div>
                  <div className="size-2 rounded-full shrink-0" style={{ background: r.cor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{r.nome}</span>
                      <span className="text-muted-foreground tabular-nums">{brl(r.total)}</span>
                    </div>
                    <div className="h-1.5 mt-1 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: r.cor }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {pct.toFixed(1)}% do grupo · {r.count} lançamentos · {r.segmento || "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Comparativo entre empresas</h2>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2">Empresa</th>
              <th className="text-left py-2 hidden sm:table-cell">Segmento</th>
              <th className="text-right py-2">Recorrente</th>
              <th className="text-right py-2">Único</th>
              <th className="text-right py-2">Total</th>
              <th className="text-right py-2">Participação</th>
            </tr>
          </thead>
          <tbody>
            {porEmpresa.map((r) => {
              const pct = totals.total > 0 ? (r.total / totals.total) * 100 : 0;
              return (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ background: r.cor }} />
                      {r.nome}
                    </div>
                  </td>
                  <td className="py-2 hidden sm:table-cell text-muted-foreground">{r.segmento || "—"}</td>
                  <td className="text-right tabular-nums">{brl(r.recorrente)}</td>
                  <td className="text-right tabular-nums">{brl(r.unico)}</td>
                  <td className="text-right tabular-nums font-medium">{brl(r.total)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function KpiCard({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
