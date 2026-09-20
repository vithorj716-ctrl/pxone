import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell, PXSALES_ACCENT } from "@/components/pxsales/pxsales-shell";
import { PIPELINE_ETAPAS } from "@/pxsales/pxsales.types";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

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

const KPIS = [
  "Leads novos", "Leads em negociação", "Cotações abertas", "Cotações aguardando retorno",
  "Cotações ganhas", "Cotações perdidas", "Valor do pipeline", "Taxa de conversão",
  "Ticket médio", "Clientes ativos", "Follow-ups atrasados", "Comissões previstas",
];

function SalesDashboard() {
  return (
    <PxSalesShell title="Dashboard" subtitle="Visão comercial">
      <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pipeline comercial</div>
        <div className="mt-3 flex gap-2 overflow-x-auto thin-scroll pb-1">
          {PIPELINE_ETAPAS.map((e) => (
            <div key={e.key} className="min-w-[8.5rem] rounded-lg ring-1 ring-border bg-background/40 p-3">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: e.cor }} />
                <span className="text-[11px] text-muted-foreground truncate">{e.label}</span>
              </div>
              <div className="mt-2 text-lg font-semibold tabular-nums text-muted-foreground/50">—</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {KPIS.map((k) => (
          <div key={k} className="rounded-lg ring-1 ring-border bg-surface/30 p-3">
            <div className="text-[11px] text-muted-foreground truncate">{k}</div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums text-muted-foreground/50">—</div>
          </div>
        ))}
      </div>

      <EmConstrucao
        etapa="Etapa 1 concluída"
        titulo="Fundação do PXSales no ar"
        descricao="Sistema, acesso próprio, layout, navegação e permissões já funcionando. Os indicadores acima passam a mostrar dados reais conforme as próximas etapas entram — nenhum número fictício é exibido."
        itens={[
          "Etapa 2 — Clientes por CNPJ e ficha 360º",
          "Etapa 3 — Leads, oportunidades e pipeline",
          "Etapa 4 — Cotações e propostas",
          "Etapa 5 — Portal de cotação",
          "Etapa 6 — Tracking público",
          "Etapa 7 — Comissões configuráveis",
        ]}
      >
        <div className="mt-4 text-[11px]" style={{ color: PXSALES_ACCENT }}>
          Grupo PX · PXSales
        </div>
      </EmConstrucao>
    </PxSalesShell>
  );
}
