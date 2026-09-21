import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FinShell, FinKpi, brl, dataBr } from "@/components/financeiro/fin-shell";
import { finVisaoGeral } from "@/lib/financeiro.functions";
import { useEmpresaAtiva } from "@/px-core/empresa-context";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  head: () => ({
    meta: [
      { title: "Financeiro PX — Visão geral" },
      { name: "description", content: "Saldo, contas a pagar e a receber, vencimentos e fluxo previsto da operação." },
      { property: "og:title", content: "Financeiro PX — Visão geral" },
      { property: "og:description", content: "Controle financeiro operacional do Grupo PX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const { empresa } = useEmpresaAtiva();
  const carregar = useServerFn(finVisaoGeral);
  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-visao", empresa?.id ?? null],
    queryFn: () => carregar({ data: { empresaId: empresa?.id ?? null } }),
  });

  return (
    <FinShell title="Visão geral" subtitle="Fatos financeiros do dia a dia">
      {error ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/60 p-6 text-sm text-rose-300">
          {(error as Error).message}
        </div>
      ) : isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinKpi label="Saldo financeiro" value={brl(data.saldo)} tone={data.saldo >= 0 ? "verde" : "vermelho"} />
            <FinKpi label="A receber em aberto" value={brl(data.aReceber)} />
            <FinKpi label="A pagar em aberto" value={brl(data.aPagar)} />
            <FinKpi label="Adiantamentos em aberto" value={brl(data.adiantamentosAbertos)} tone="ambar" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinKpi label="Vencendo hoje (receber)" value={brl(data.receberHoje)} />
            <FinKpi label="Vencendo hoje (pagar)" value={brl(data.pagarHoje)} />
            <FinKpi label="Vencido (receber)" value={brl(data.receberVencido)} tone="vermelho" />
            <FinKpi label="Vencido (pagar)" value={brl(data.pagarVencido)} tone="vermelho" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinKpi label="Previsto receber (30d)" value={brl(data.receberPrevisto30)} />
            <FinKpi label="Previsto pagar (30d)" value={brl(data.pagarPrevisto30)} />
            <FinKpi label="Recebido (90d)" value={brl(data.recebimentosRealizados)} tone="verde" />
            <FinKpi label="Pago (90d)" value={brl(data.pagamentosRealizados)} />
          </div>

          <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              Fluxo previsto — próximos 30 dias
            </div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Dia</th>
                  <th className="text-right p-2">Entradas</th>
                  <th className="text-right p-2">Saídas</th>
                  <th className="text-right p-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.fluxo.filter((f: any) => f.entradas || f.saidas).length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem vencimentos previstos nos próximos 30 dias.</td></tr>
                ) : data.fluxo.filter((f: any) => f.entradas || f.saidas).map((f: any) => (
                  <tr key={f.dia} className="border-b border-border/40">
                    <td className="p-2">{dataBr(f.dia)}</td>
                    <td className="p-2 text-right tabular-nums text-emerald-400">{brl(f.entradas)}</td>
                    <td className="p-2 text-right tabular-nums text-rose-300">{brl(f.saidas)}</td>
                    <td className="p-2 text-right tabular-nums">{brl(f.entradas - f.saidas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Análises gerenciais (DRE, DFC, margem, markup, ponto de equilíbrio e indicadores) continuam na Gestão.
          </p>
        </>
      )}
    </FinShell>
  );
}
