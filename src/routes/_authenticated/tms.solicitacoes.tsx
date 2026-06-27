import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { STATUS_VOL_LABEL } from "@/lib/tms";

export const Route = createFileRoute("/_authenticated/tms/solicitacoes")({
  head: () => ({ meta: [{ title: "PXLog — Solicitações de Embarque" }] }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tms_minutas")
        .select("id, numero, status, origem, destino, qtd_volumes, peso_taxado, valor_frete, created_at, tms_clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as any[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell
      title="Solicitações de Embarque"
      subtitle="Minutas geradas e seus status"
      headerActions={
        <Link
          to="/tms/solicitacoes/nova"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand text-brand-foreground hover:opacity-90"
        >
          <Plus className="size-3.5" /> Nova solicitação
        </Link>
      }
    >
      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-3">Minuta</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Rota</th>
              <th className="text-right p-3">Vol.</th>
              <th className="text-right p-3">Peso tax.</th>
              <th className="text-right p-3">Frete</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma minuta ainda.</td></tr>
            ) : rows.map((r) => {
              const st = STATUS_VOL_LABEL[r.status];
              return (
                <tr key={r.id} className="border-b border-border/40 hover:bg-surface-2/40">
                  <td className="p-3 font-mono">
                    <Link to="/tms/minutas/$numero" params={{ numero: String(r.numero) }} className="text-brand hover:underline">
                      #{r.numero}
                    </Link>
                  </td>
                  <td className="p-3">{r.tms_clientes?.nome ?? "—"}</td>
                  <td className="p-3">{r.origem} → {r.destino}</td>
                  <td className="p-3 text-right tabular-nums">{r.qtd_volumes}</td>
                  <td className="p-3 text-right tabular-nums">{Number(r.peso_taxado).toFixed(1)} kg</td>
                  <td className="p-3 text-right tabular-nums">{Number(r.valor_frete).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="p-3"><span className={`text-[10px] px-2 py-0.5 rounded ${st?.cor || "bg-muted"}`}>{st?.label || r.status}</span></td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
