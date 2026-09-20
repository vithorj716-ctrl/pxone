import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/portal")({
  head: () => ({
    meta: [
      { title: "PXSales — Portal do cliente | Grupo PX" },
      { name: "description", content: "Links seguros de cotação e acompanhamento enviados aos clientes." },
      { property: "og:title", content: "PXSales — Portal do cliente" },
      { property: "og:description", content: "Links seguros de cotação e acompanhamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Portal do Cliente" subtitle="Links e acessos">
      <EmConstrucao
        etapa="Etapas 5 e 6"
        titulo="Links seguros para o cliente"
        descricao="Geração de links com código aleatório para cotação e acompanhamento, sem expor informações internas. É possível copiar, abrir, revogar, regerar e ver a validade de cada link."
        itens={["Link de cotação", "Link de acompanhamento", "Validade configurável", "Registro de abertura, aceite e recusa"]}
      />
    </PxSalesShell>
  ),
});
