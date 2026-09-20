import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { PIPELINE_ETAPAS } from "@/pxsales/pxsales.types";
import { getDashboardPxSales } from "@/lib/pxsales-relatorios.functions";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({
    meta: [
      { title: "PXSales — Dashboard comercial | Grupo PX" },
      { name: "description", content: "Pipeline, cotações, follow-ups e comissões da operação comercial do Grupo PX." },
      { property: "og:title", content: "PXSales — Dashboard comercial" },
      { property: "og:description", content: "Visão comercial da operação logística do Grupo PX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesDashboard,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dh = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem data");

function SalesDashboard() {
  const fn = useServerFn(getDashboardPxSales);
  const { data, isLoading } = useQuery({ queryKey: ["pxsales", "dashboard"], queryFn: () => fn() });

  const k = data?.kpis;
  const pipeline = new Map((data?.pipeline ?? []).map((p) => [p.etapa, p]));

  return (
    <PxSalesShell title="Dashboard" subtitle="Visão comercial">
      <div className="space-y-4">
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pipeline comercial</div>
          <div className="mt-3 flex gap-2 overflow-x-auto thin-scroll pb-1">
            {PIPELINE_ETAPAS.map((e) => {
              const p = pipeline.get(e.key);
              return (
                <Link
                  key={e.key}
                  to="/sales/oportunidades"
                  className="min-w-[8.5rem] rounded-lg ring-1 ring-border bg-background/40 p-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: e.cor }} />
                    <span className="text-[11px] text-muted-foreground truncate">{e.label}</span>
                  </div>
                  <div className="mt-2 text-lg font-semibold tabular-nums">{p?.qtd ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{brl(p?.valor ?? 0)}</div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          <Kpi label="Leads novos" valor={k?.leads_novos} />
          <Kpi label="Leads em negociação" valor={k?.leads_negociacao} />
          <Kpi label="Cotações abertas" valor={k?.cotacoes_abertas} />
          <Kpi label="Aguardando retorno" valor={k?.cotacoes_aguardando} />
          <Kpi label="Propostas aceitas" valor={k?.propostas_aceitas} />
          <Kpi label="Propostas recusadas" valor={k?.propostas_recusadas} />
          <Kpi label="Valor do pipeline" valor={k ? brl(k.valor_pipeline) : undefined} />
          <Kpi label="Taxa de conversão" valor={k ? `${k.taxa_conversao}%` : undefined} />
          <Kpi label="Ticket médio" valor={k ? brl(k.ticket_medio) : undefined} />
          <Kpi label="Clientes ativos" valor={k?.clientes_ativos} />
          <Kpi label="Follow-ups atrasados" valor={k?.followups_atrasados} />
          <Kpi label="Comissões previstas" valor={k ? brl(k.comissoes_previstas) : undefined} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Próximos compromissos</h2>
              <Link to="/sales/agenda" className="text-xs text-muted-foreground hover:underline">Ver agenda</Link>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground mt-3">Carregando…</p>
            ) : (data?.agenda.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Nenhum compromisso em aberto.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data!.agenda.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{a.titulo}</span>
                    <span className={a.atrasada ? "text-red-600 text-xs shrink-0" : "text-muted-foreground text-xs shrink-0"}>
                      {dh(a.data_prevista)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Últimas propostas</h2>
              <Link to="/sales/propostas" className="text-xs text-muted-foreground hover:underline">Ver todas</Link>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground mt-3">Carregando…</p>
            ) : (data?.ultimas_propostas.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Nenhuma proposta ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data!.ultimas_propostas.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/sales/propostas/$id"
                      params={{ id: p.id }}
                      className="flex items-center justify-between gap-3 text-sm hover:underline"
                    >
                      <span className="truncate">nº {p.numero} — {p.empresa_nome}</span>
                      <span className="shrink-0 tabular-nums">{brl(p.valor_total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PxSalesShell>
  );
}

function Kpi({ label, valor }: { label: string; valor?: number | string }) {
  return (
    <div className="rounded-lg ring-1 ring-border bg-surface/30 p-3">
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums">
        {valor === undefined ? <span className="text-muted-foreground/50">—</span> : valor}
      </div>
    </div>
  );
}
