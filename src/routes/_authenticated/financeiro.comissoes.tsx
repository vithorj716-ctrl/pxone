import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarComissoes, finAgendarComissao } from "@/lib/financeiro-extras.functions";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões — Financeiro PX" },
      { name: "description", content: "Fila de pagamento das comissões apuradas no PXSales." },
      { property: "og:title", content: "Comissões — Financeiro PX" },
      { property: "og:description", content: "Agendamento e pagamento de comissões comerciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Comissoes,
});

function Comissoes() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const listar = useServerFn(finListarComissoes);
  const agendar = useServerFn(finAgendarComissao);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-comissoes", empresa?.id ?? null],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null } }),
  });

  const mAgendar = useMutation({
    mutationFn: (comissaoId: string) => agendar({ data: { comissaoId } }),
    onSuccess: (r: any) => {
      toast[r?.repetido ? "info" : "success"](r?.repetido ? "Comissão já agendada" : "Comissão agendada para pagamento");
      qc.invalidateQueries({ queryKey: ["fin-comissoes"] });
      qc.invalidateQueries({ queryKey: ["fin-titulos", "pagar"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as any[];
  const titulos = (data?.titulos ?? []) as any[];
  const tituloDe = (id: string) => titulos.find((t) => t.origem_id === id);

  return (
    <FinShell title="Comissões" subtitle="Apuradas no PXSales — o Financeiro apenas paga">
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}
      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Competência</th>
              <th className="text-left p-2">Beneficiário</th>
              <th className="text-right p-2">Base</th>
              <th className="text-right p-2">Comissão</th>
              <th className="text-left p-2">Status PXSales</th>
              <th className="text-left p-2">Título financeiro</th>
              <th className="text-right p-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma comissão apurada.</td></tr>
            ) : rows.map((c) => {
              const t = tituloDe(c.id);
              return (
                <tr key={c.id} className="border-b border-border/40">
                  <td className="p-2">{c.competencia ?? dataBr(c.created_at?.slice(0, 10))}</td>
                  <td className="p-2">{c.beneficiario_nome ?? c.vendedor_nome ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{brl(c.base_calculo ?? c.valor_base)}</td>
                  <td className="p-2 text-right tabular-nums">{brl(c.valor_comissao ?? c.valor)}</td>
                  <td className="p-2"><FinStatus status={c.status ?? "apurada"} /></td>
                  <td className="p-2">{t ? `${t.status} — vence ${dataBr(t.vencimento)}` : "—"}</td>
                  <td className="p-2 text-right">
                    {!t && (
                      <button disabled={mAgendar.isPending} onClick={() => mAgendar.mutate(c.id)}
                        className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Agendar pagamento</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FinShell>
  );
}
