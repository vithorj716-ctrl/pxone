import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/oportunidades")({
  head: () => ({
    meta: [
      { title: "PXSales — Oportunidades | Grupo PX" },
      { name: "description", content: "Pipeline de oportunidades comerciais em kanban, por etapa e responsável." },
      { property: "og:title", content: "PXSales — Oportunidades" },
      { property: "og:description", content: "Pipeline de oportunidades comerciais em kanban." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Oportunidades" subtitle="Pipeline">
      <EmConstrucao
        etapa="Etapa 3"
        titulo="Kanban de oportunidades"
        descricao="Oportunidades por cliente e responsável, com valor estimado, frequência, margem, previsão de fechamento e probabilidade, movimentadas arrastando entre as etapas."
        itens={["Arrastar entre etapas", "Histórico de mudança de etapa", "Etapas configuráveis pelo administrador", "Filtro por responsável e período"]}
      />
    </PxSalesShell>
  ),
});
