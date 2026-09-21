import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finFaturamentoElegivel, finFaturarMinuta } from "@/lib/financeiro-extras.functions";

export const Route = createFileRoute("/_authenticated/financeiro/faturamento")({
  head: () => ({
    meta: [
      { title: "Faturamento — Financeiro PX" },
      { name: "description", content: "Minutas entregues prontas para faturar e faturamentos já gerados." },
      { property: "og:title", content: "Faturamento — Financeiro PX" },
      { property: "og:description", content: "Faturamento originado das entregas do PXLog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Faturamento,
});

function Faturamento() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const listar = useServerFn(finFaturamentoElegivel);
  const faturar = useServerFn(finFaturarMinuta);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-faturamento", empresa?.id ?? null],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null } }),
  });

  const mFaturar = useMutation({
    mutationFn: (minutaId: string) => faturar({ data: { minutaId, empresaId: empresa?.id ?? null } }),
    onSuccess: (r: any) => {
      toast[r?.repetido ? "info" : "success"](r?.repetido ? "Minuta já faturada" : "Faturamento gerado");
      qc.invalidateQueries({ queryKey: ["fin-faturamento"] });
      qc.invalidateQueries({ queryKey: ["fin-titulos", "receber"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const elegiveis = (data?.elegiveis ?? []) as any[];
  const faturados = (data?.faturados ?? []) as any[];

  return (
    <FinShell title="Faturamento" subtitle="Origem: entregas do PXLog">
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
          Minutas entregues não faturadas
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Minuta</th>
              <th className="text-left p-2">Cliente</th>
              <th className="text-left p-2">Trecho</th>
              <th className="text-right p-2">Frete</th>
              <th className="text-right p-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : elegiveis.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma minuta pendente de faturamento.</td></tr>
            ) : elegiveis.map((m) => (
              <tr key={m.id} className="border-b border-border/40">
                <td className="p-2">{m.numero ?? m.id.slice(0, 8)}</td>
                <td className="p-2">{m.tms_clientes?.nome ?? "—"}</td>
                <td className="p-2">{[m.origem, m.destino].filter(Boolean).join(" → ") || "—"}</td>
                <td className="p-2 text-right tabular-nums">{brl(m.valor_frete)}</td>
                <td className="p-2 text-right">
                  <button disabled={mFaturar.isPending} onClick={() => mFaturar.mutate(m.id)}
                    className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Faturar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">Faturamentos gerados</div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Origem</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {faturados.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum faturamento registrado.</td></tr>
            ) : faturados.map((f) => (
              <tr key={f.id} className="border-b border-border/40">
                <td className="p-2">{dataBr(f.created_at?.slice(0, 10))}</td>
                <td className="p-2">{f.origem_tipo ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{brl(f.valor)}</td>
                <td className="p-2"><FinStatus status={f.status ?? "gerado"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FinShell>
  );
}
