import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FinShell, brl } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finRelatorio } from "@/lib/financeiro-extras.functions";

export const Route = createFileRoute("/_authenticated/financeiro/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Financeiro PX" },
      { name: "description", content: "Relatórios de contas a pagar, a receber, movimentos e inadimplência." },
      { property: "og:title", content: "Relatórios — Financeiro PX" },
      { property: "og:description", content: "Relatórios financeiros exportáveis em CSV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Relatorios,
});

const TIPOS = [
  { v: "pagar", label: "Contas a pagar" },
  { v: "receber", label: "Contas a receber" },
  { v: "movimentos", label: "Movimentos" },
  { v: "inadimplencia", label: "Inadimplência" },
] as const;

function Relatorios() {
  const { empresa } = useEmpresaAtiva();
  const [tipo, setTipo] = useState<"pagar" | "receber" | "movimentos" | "inadimplencia">("receber");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const rodar = useServerFn(finRelatorio);
  const params = { empresaId: empresa?.id ?? null, tipo, de: de || null, ate: ate || null };
  const { data, isLoading, error } = useQuery({ queryKey: ["fin-rel", params], queryFn: () => rodar({ data: params }) });

  const rows = (data ?? []) as any[];
  const colunas = rows.length ? Object.keys(rows[0]).filter((c) => !c.endsWith("_id") || c === "empresa_id").slice(0, 10) : [];
  const total = rows.reduce((a, r) => a + Number(r.valor ?? 0), 0);

  function baixarCsv() {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => String(r[c] ?? "").replace(/;/g, ",")).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro-${tipo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <FinShell
      title="Relatórios"
      subtitle="Financeiro operacional"
      actions={<button onClick={baixarCsv} className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border">Exportar CSV</button>}
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <select className="input w-52" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <input type="date" className="input w-40" value={de} onChange={(e) => setDe(e.target.value)} />
        <input type="date" className="input w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
        <div className="ml-auto self-center text-muted-foreground">Total: <span className="tabular-nums text-foreground">{brl(total)}</span></div>
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        {error ? (
          <div className="p-6 text-center text-xs text-rose-300">{(error as Error).message}</div>
        ) : isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Sem dados para o período.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">{colunas.map((c) => <th key={c} className="text-left p-2">{c.replace(/_/g, " ")}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r, i) => (
                <tr key={r.id ?? i} className="border-b border-border/40">
                  {colunas.map((c) => (
                    <td key={c} className="p-2 whitespace-nowrap">
                      {typeof r[c] === "number" ? (c.includes("valor") ? brl(r[c]) : r[c]) : String(r[c] ?? "—").slice(0, 40)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        DRE, DFC, margem e indicadores gerenciais continuam na Gestão; aqui ficam os relatórios de caixa e títulos.
      </p>
    </FinShell>
  );
}
