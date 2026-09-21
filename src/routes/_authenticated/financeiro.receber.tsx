import { createFileRoute } from "@tanstack/react-router";
import { TitulosPage } from "@/components/financeiro/titulos-page";

export const Route = createFileRoute("/_authenticated/financeiro/receber")({
  head: () => ({
    meta: [
      { title: "Contas a receber — Financeiro PX" },
      { name: "description", content: "Títulos a receber, inadimplência, baixas parciais e histórico." },
      { property: "og:title", content: "Contas a receber — Financeiro PX" },
      { property: "og:description", content: "Gestão de títulos a receber da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TitulosPage modo="receber" />,
});
