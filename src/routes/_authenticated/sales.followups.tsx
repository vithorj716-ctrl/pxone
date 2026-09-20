import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/followups")({
  head: () => ({
    meta: [
      { title: "PXSales — Follow-ups | Grupo PX" },
      { name: "description", content: "Follow-ups comerciais do dia, atrasados e programados." },
      { property: "og:title", content: "PXSales — Follow-ups" },
      { property: "og:description", content: "Follow-ups comerciais do dia e atrasados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Follow-ups" subtitle="Retornos e cobranças">
      <EmConstrucao
        etapa="Etapa 3"
        titulo="Follow-ups comerciais"
        descricao="Lista do que precisa de retorno hoje, o que está atrasado e o que está programado, ligada a leads, oportunidades e cotações."
        itens={["Hoje", "Atrasados", "Programados", "Registro rápido de contato"]}
      />
    </PxSalesShell>
  ),
});
