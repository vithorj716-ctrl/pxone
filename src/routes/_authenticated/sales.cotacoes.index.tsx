import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/cotacoes/")({
  head: () => ({
    meta: [
      { title: "PXSales — Cotações | Grupo PX" },
      { name: "description", content: "Cotações de frete com origem, destino, carga, operação e condições comerciais." },
      { property: "og:title", content: "PXSales — Cotações" },
      { property: "og:description", content: "Cotações de frete da operação logística." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Cotações" subtitle="Frete e serviços">
      <EmConstrucao
        etapa="Etapa 4"
        titulo="Cotações logísticas"
        descricao="Cotação de transporte com origem, destino, carga, tipo de operação e condições comerciais, reaproveitando as tabelas de frete e o cálculo já usados na operação."
        itens={["Origem e destino com CEP", "Volumes, peso, cubagem e valor da mercadoria", "Pedágio, GRIS, ad-valorem e taxas", "Validade e conversão em proposta"]}
      />
    </PxSalesShell>
  ),
});
