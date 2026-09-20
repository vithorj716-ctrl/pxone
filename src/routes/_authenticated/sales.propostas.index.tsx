import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/propostas/")({
  head: () => ({
    meta: [
      { title: "PXSales — Propostas | Grupo PX" },
      { name: "description", content: "Propostas comerciais enviadas, visualizadas, aceitas ou recusadas." },
      { property: "og:title", content: "PXSales — Propostas" },
      { property: "og:description", content: "Propostas comerciais e seus status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Propostas" subtitle="Envio e aceite">
      <EmConstrucao
        etapa="Etapa 4"
        titulo="Propostas comerciais"
        descricao="Cotação vira proposta com valores, prazos, condições e anexos, acompanhando cada mudança de status com data e hora."
        itens={["Rascunho e envio", "Visualizada pelo cliente", "Em negociação", "Aceita, recusada, expirada ou cancelada"]}
      />
    </PxSalesShell>
  ),
});
