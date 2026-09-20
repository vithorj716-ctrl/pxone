import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/propostas/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Proposta | Grupo PX" },
      { name: "description", content: "Detalhe da proposta comercial, condições, validade e aceite do cliente." },
      { property: "og:title", content: "PXSales — Proposta" },
      { property: "og:description", content: "Detalhe da proposta comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropostaDetalhe,
});

function PropostaDetalhe() {
  const { id } = Route.useParams();
  return (
    <PxSalesShell title="Proposta" subtitle={id}>
      <EmConstrucao
        etapa="Etapa 4"
        titulo="Detalhe da proposta"
        descricao="Condições, valores, prazo, anexos e a linha do tempo completa do que o cliente fez com a proposta."
        itens={["Linha do tempo de status", "Anexos", "Link do portal", "Registro de aceite"]}
      />
    </PxSalesShell>
  );
}
