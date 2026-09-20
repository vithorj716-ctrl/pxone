import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/tracking")({
  head: () => ({
    meta: [
      { title: "PXSales — Tracking | Grupo PX" },
      { name: "description", content: "Acompanhamento das operações dos clientes da carteira comercial." },
      { property: "og:title", content: "PXSales — Tracking" },
      { property: "og:description", content: "Acompanhamento das operações da carteira comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Tracking" subtitle="Operações da carteira">
      <EmConstrucao
        etapa="Etapa 6"
        titulo="Acompanhamento das entregas"
        descricao="Consulta das operações dos clientes da carteira lendo diretamente os dados reais da operação logística, sem criar uma segunda fonte de informação de status."
        itens={["Busca por minuta, volume ou cliente", "Eventos e ocorrências", "Previsão e última atualização", "Comprovante de entrega"]}
      />
    </PxSalesShell>
  ),
});
