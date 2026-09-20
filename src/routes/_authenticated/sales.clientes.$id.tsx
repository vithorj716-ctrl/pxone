import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/clientes/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Ficha do cliente | Grupo PX" },
      { name: "description", content: "Visão 360º do cliente: cadastro, contatos, cotações, operações e histórico." },
      { property: "og:title", content: "PXSales — Ficha do cliente" },
      { property: "og:description", content: "Visão 360º comercial e operacional do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClienteDetalhe,
});

const ABAS = [
  "Dados cadastrais", "Contatos", "Endereços", "Oportunidades", "Cotações", "Propostas",
  "Entregas", "Tracking", "Interações", "Follow-ups", "Tabelas", "Comissões", "Documentos", "Histórico",
];

function ClienteDetalhe() {
  const { id } = Route.useParams();
  return (
    <PxSalesShell title="Cliente" subtitle="Visão 360º">
      <EmConstrucao
        etapa="Etapa 2"
        titulo="Ficha completa do cliente"
        descricao={`Reúne cadastro, relacionamento comercial e operação real do cliente ${id} em uma única tela.`}
        itens={ABAS}
      />
    </PxSalesShell>
  );
}
