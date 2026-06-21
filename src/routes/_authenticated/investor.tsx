import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, fmtDate } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/investor")({
  head: () => ({ meta: [{ title: "PXOne — Investor Room" }] }),
  component: InvestorPage,
});

function InvestorPage() {
  return (
    <AppShell title="Investor Room" subtitle="Comunicados e relatórios para investidores">
      <CrudTable
        table="investor_updates"
        title="Atualizações"
        fields={[
          { name: "titulo", label: "Título", type: "text", required: true },
          { name: "periodo", label: "Período (ex: 2026-Q1)", type: "text" },
          { name: "autor", label: "Autor", type: "text" },
          { name: "conteudo", label: "Conteúdo", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          { key: "titulo", label: "Título" },
          { key: "periodo", label: "Período" },
          { key: "autor", label: "Autor" },
          { key: "created_at", label: "Publicado em", format: (v) => fmtDate(v) },
        ]}
      />
    </AppShell>
  );
}
