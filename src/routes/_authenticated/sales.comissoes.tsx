import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/comissoes")({
  head: () => ({
    meta: [
      { title: "PXSales — Comissões | Grupo PX" },
      { name: "description", content: "Comissões previstas, aprovadas e pagas por comercial, cliente e período." },
      { property: "og:title", content: "PXSales — Comissões" },
      { property: "og:description", content: "Comissões por comercial, cliente e período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Comissões" subtitle="Previsto, aprovado e pago">
      <EmConstrucao
        etapa="Etapa 7"
        titulo="Comissões configuráveis"
        descricao="Regras criadas pelo administrador por percentual, margem, valor fixo, cliente, serviço, tabela ou faixa, sempre com vigência. Ao gerar a comissão, a regra usada fica gravada — mudar a regra depois não altera o histórico."
        itens={["Visão do comercial", "Visão administrativa", "Prevista, elegível, aprovada, paga", "Cancelada e estornada com auditoria"]}
      />
    </PxSalesShell>
  ),
});
