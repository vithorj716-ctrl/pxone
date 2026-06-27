import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Trophy, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/consolidado")({
  head: () => ({ meta: [{ title: "PX Platform — Visão Consolidada" }] }),
  component: ConsolidadoPage,
});

type CustoRow = { empresa_id: string | null; valor: number | null; tipo: string | null };

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
      const { data } = await supabase.from("custos").select("empresa_id, valor, tipo");
      setCustos((data ?? []) as CustoRow[]);
      setLoading(false);
    })();
  }, []);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { custos: number; receitas: number }>();
    for (const row of custos) {
      const key = row.empresa_id || "sem-empresa";
      const cur = map.get(key) ?? { custos: 0, receitas: 0 };
      const v = Number(row.valor || 0);
      if (row.tipo === "receita") cur.receitas += v;
      else cur.custos += v;
      map.set(key, cur);
    }
    return empresas.map((e) => {
      const m = map.get(e.id) ?? { custos: 0, receitas: 0 };
      return {
        id: e.id,
        nome: e.nome_fantasia || e.nome,
        cor: e.cor_primaria || "#3B82F6",
        custos: m.custos,
        receitas: m.receitas,
        lucro: m.receitas - m.custos,
      };
    });
  }, [custos, empresas]);

  const totals = useMemo(() => {
    const receitas = porEmpresa.reduce((a, b) => a + b.receitas, 0);
    const custosT = porEmpresa.reduce((a, b) => a + b.custos, 0);
    return { receitas, custos: custosT, lucro: receitas - custosT };
  }, [porEmpresa]);

  const ranking = useMemo(
    () => [...porEmpresa].sort((a, b) => b.lucro - a.lucro),
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
      {/* Cards de totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Wallet className="size-4" />} label="Receitas" value={brl(totals.receitas)} />
        <KpiCard icon={<TrendingUp className="size-4" />} label="Custos" value={brl(totals.custos)} />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Lucro"
          value={brl(totals.lucro)}
          accent={totals.lucro >= 0 ? "emerald" : "rose"}
        />
        <KpiCard icon={<Layers className="size-4" />} label="Empresas" value={String(empresas.length)} />
      </div>

      {/* Ranking */}
      <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">Ranking por lucratividade</h2>
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Carregando…</div>
        ) : ranking.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados.</div>
        ) : (
          <div className="space-y-2">
            {ranking.map((r, idx) => {
              const pct = totals.receitas > 0 ? (r.receitas / totals.receitas) * 100 : 0;
              return (
                <div key={r.id} className="flex items-center gap-3 text-xs">
                  <div className="w-5 text-center text-muted-foreground font-mono">{idx + 1}</div>
                  <div className="size-2 rounded-full shrink-0" style={{ background: r.cor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{r.nome}</span>
                      <span className="text-muted-foreground tabular-nums">{brl(r.lucro)}</span>
                    </div>
                    <div className="h-1.5 mt-1 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: r.cor }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {pct.toFixed(1)}% do faturamento · custos {brl(r.custos)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparativo */}
      <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Comparativo entre empresas</h2>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2">Empresa</th>
              <th className="text-right py-2">Receitas</th>
              <th className="text-right py-2">Custos</th>
              <th className="text-right py-2">Lucro</th>
              <th className="text-right py-2">Margem</th>
            </tr>
          </thead>
          <tbody>
            {porEmpresa.map((r) => {
              const margem = r.receitas > 0 ? (r.lucro / r.receitas) * 100 : 0;
              return (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ background: r.cor }} />
                      {r.nome}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{brl(r.receitas)}</td>
                  <td className="text-right tabular-nums">{brl(r.custos)}</td>
                  <td className={`text-right tabular-nums ${r.lucro >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {brl(r.lucro)}
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">{margem.toFixed(1)}%</td>
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
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent?: "emerald" | "rose" }) {
  const color =
    accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
