import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/agenda")({
  head: () => ({
    meta: [
      { title: "PXSales — Agenda | Grupo PX" },
      { name: "description", content: "Agenda comercial de visitas, reuniões e retornos." },
      { property: "og:title", content: "PXSales — Agenda" },
      { property: "og:description", content: "Agenda comercial de visitas e retornos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Agenda" subtitle="Visitas e reuniões">
      <EmConstrucao
        etapa="Etapa 3"
        titulo="Agenda comercial"
        descricao="Visão de dia e semana com visitas, reuniões e retornos por responsável, alimentada pelas atividades e follow-ups."
        itens={["Dia e semana", "Por responsável", "Vinculada ao cliente", "Criação rápida"]}
      />
    </PxSalesShell>
  ),
});
