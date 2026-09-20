import { createFileRoute } from "@tanstack/react-router";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";

export const Route = createFileRoute("/_authenticated/sales/contatos")({
  head: () => ({
    meta: [
      { title: "PXSales — Contatos | Grupo PX" },
      { name: "description", content: "Contatos comerciais por empresa, com setor, cargo e interações." },
      { property: "og:title", content: "PXSales — Contatos" },
      { property: "og:description", content: "Contatos comerciais por empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PxSalesShell title="Contatos" subtitle="Pessoas por empresa">
      <EmConstrucao
        etapa="Etapa 2"
        titulo="Agenda de contatos"
        descricao="Vários contatos por empresa, com contato principal, setor, telefone, WhatsApp, e-mail e registro de interações — sobre os contatos já existentes no cadastro do grupo."
        itens={["Contato principal por empresa", "Setor e cargo", "Registro de interações", "WhatsApp e ligação rápida"]}
      />
    </PxSalesShell>
  ),
});
