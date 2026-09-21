import { createFileRoute } from "@tanstack/react-router";
import { TitulosPage } from "@/components/financeiro/titulos-page";

export const Route = createFileRoute("/_authenticated/financeiro/pagar")({
  head: () => ({
    meta: [
      { title: "Contas a pagar — Financeiro PX" },
      { name: "description", content: "Títulos a pagar, vencimentos, baixas parciais e histórico de pagamentos." },
      { property: "og:title", content: "Contas a pagar — Financeiro PX" },
      { property: "og:description", content: "Gestão de títulos a pagar da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <TitulosPage modo="pagar" />,
});
