import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/financeiro")({
  head: () => ({ meta: [{ title: "PXLog — Financeiro" }] }),
  component: FinanceiroPage,
});

function brl(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function FinanceiroPage() {
  const { empresa } = useEmpresaAtiva();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("tms_minutas")
      .select("id, numero, status, status_financeiro, valor_frete, valor_mercadoria, origem, destino, empresa_id, tms_clientes(nome)")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as any[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function liberar(m: any) {
    if (m.status !== "entregue") {
      toast.error("Só é possível faturar após a entrega");
      return;
    }
    // Cria lançamento em custos (módulo existente) — receita identificada por descrição/categoria
    const { error: ce } = await supabase.from("custos").insert({
      nome: `Receita TMS — Minuta #${m.numero}`,
      descricao: `[TMS] Frete minuta ${m.numero} — ${m.tms_clientes?.nome ?? ""} (${m.origem} → ${m.destino})`,
      valor: Number(m.valor_frete),
      empresa_id: m.empresa_id ?? empresa?.id ?? null,
      tipo_custo: "unico",
      status: "pago",
      centro_custo: "Receita TMS",
    });
    if (ce) { toast.error(ce.message); return; }
    await supabase.from("tms_minutas").update({ status_financeiro: "faturado" }).eq("id", m.id);
    toast.success(`Minuta #${m.numero} faturada e enviada à Central de Custos`);
    void load();
  }

  const totais = {
    previsto: rows.filter((r) => r.status_financeiro === "previsto").reduce((a, b) => a + Number(b.valor_frete || 0), 0),
    faturado: rows.filter((r) => r.status_financeiro === "faturado").reduce((a, b) => a + Number(b.valor_frete || 0), 0),
  };

  return (
    <AppShell title="Financeiro TMS" subtitle="Liberação para faturamento integra com a Central de Custos">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Previsto" value={brl(totais.previsto)} />
        <KpiCard label="Faturado" value={brl(totais.faturado)} accent="emerald" />
        <KpiCard label="Minutas" value={String(rows.length)} />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-3">Minuta</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Status op.</th>
              <th className="text-left p-3">Financeiro</th>
              <th className="text-right p-3">Frete</th>
              <th className="text-right p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="p-3 font-mono">#{r.numero}</td>
                <td className="p-3">{r.tms_clientes?.nome ?? "—"}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    r.status_financeiro === "faturado" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
                  }`}>{r.status_financeiro}</span>
                </td>
                <td className="p-3 text-right tabular-nums">{brl(Number(r.valor_frete))}</td>
                <td className="p-3 text-right">
                  {r.status_financeiro === "faturado" ? (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  ) : (
                    <button onClick={() => liberar(r)}
                      disabled={r.status !== "entregue"}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-brand text-brand-foreground disabled:opacity-40">
                      <CircleDollarSign className="size-3" /> Faturar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "emerald" }) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent === "emerald" ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
