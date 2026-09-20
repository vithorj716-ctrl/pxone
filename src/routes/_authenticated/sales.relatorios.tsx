import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/relatorios")({
  head: () => ({
    meta: [
      { title: "PXSales — Relatórios | Grupo PX" },
      { name: "description", content: "Relatórios de pipeline, conversão, propostas, perdas e desempenho comercial." },
      { property: "og:title", content: "PXSales — Relatórios" },
      { property: "og:description", content: "Relatórios de desempenho comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Relatórios" subtitle="Desempenho comercial">
      <EmConstrucao
        etapa="Etapa 8"
        titulo="Relatórios comerciais"
        descricao="Pipeline, vendas, conversão, clientes, cotações, propostas, motivos de perda, origem dos leads, comissões e faturamento originado pelo comercial, com filtros por período, comercial, cliente, origem, etapa, serviço e empresa."
        itens={["Filtros combinados", "Exportação", "Comparativo por período", "Motivos de perda"]}
      />
    </PxSalesShell>
  ),
});
