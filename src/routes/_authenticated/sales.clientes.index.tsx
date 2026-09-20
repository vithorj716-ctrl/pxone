import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/clientes/")({
  head: () => ({
    meta: [
      { title: "PXSales — Empresas | Grupo PX" },
      { name: "description", content: "Carteira de empresas e clientes comerciais do Grupo PX." },
      { property: "og:title", content: "PXSales — Empresas" },
      { property: "og:description", content: "Carteira de empresas e clientes comerciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Empresas" subtitle="Carteira comercial">
      <EmConstrucao
        etapa="Etapa 2"
        titulo="Carteira de empresas"
        descricao="Lista da carteira com busca, filtros, responsável, segmento, potencial, última cotação e situação comercial — lendo o cadastro único do Grupo PX, sem criar uma segunda base de clientes."
        itens={["Busca por CNPJ, razão social e fantasia", "Consulta automática de CNPJ", "Vínculo do cliente ao PXSales", "Ficha 360º do cliente"]}
      />
    </PxSalesShell>
  ),
});
