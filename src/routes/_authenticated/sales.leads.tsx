import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/leads")({
  head: () => ({
    meta: [
      { title: "PXSales — Leads | Grupo PX" },
      { name: "description", content: "Captação e qualificação de leads comerciais da operação logística." },
      { property: "og:title", content: "PXSales — Leads" },
      { property: "og:description", content: "Captação e qualificação de leads comerciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Leads" subtitle="Captação e qualificação">
      <EmConstrucao
        etapa="Etapa 3"
        titulo="Módulo de leads"
        descricao="Cadastro de leads com CNPJ, contato, origem, responsável, potencial de carga, próxima ação e conversão em cliente/oportunidade sem duplicar CNPJ."
        itens={["Lista com filtros e busca", "Histórico de atividades", "Conversão em oportunidade", "Próximo contato e follow-up"]}
      />
    </PxSalesShell>
  ),
});
