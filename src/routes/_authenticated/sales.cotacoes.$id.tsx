import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/cotacoes/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Cotação | Grupo PX" },
      { name: "description", content: "Detalhe da cotação de frete, valores, validade e conversão em proposta." },
      { property: "og:title", content: "PXSales — Cotação" },
      { property: "og:description", content: "Detalhe da cotação de frete." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotacaoDetalhe,
});

function CotacaoDetalhe() {
  const { id } = Route.useParams();
  return (
    <PxSalesShell title="Cotação" subtitle={id}>
      <EmConstrucao
        etapa="Etapa 4"
        titulo="Detalhe da cotação"
        descricao="Composição do frete, adicionais, desconto, valor final, validade e o caminho para virar proposta e link ao cliente."
        itens={["Composição do valor", "Histórico de alterações", "Gerar proposta", "Gerar link do portal"]}
      />
    </PxSalesShell>
  );
}
