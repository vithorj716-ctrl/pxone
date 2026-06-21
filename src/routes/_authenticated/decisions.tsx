import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtBRL, fmtDate } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({ meta: [{ title: "PXOne — Decision Center" }] }),
  component: DecisionsPage,
});

function DecisionsPage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="Decision Center" subtitle="Governança e decisões corporativas">
      <CrudTable
        table="decisions"
        title="Decisões registradas"
        fields={[
          { name: "titulo", label: "Título da decisão", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "pendente", label: "Pendente" },
              { value: "em_votacao", label: "Em votação" },
              { value: "aprovada", label: "Aprovada" },
              { value: "rejeitada", label: "Rejeitada" },
              { value: "implementada", label: "Implementada" },
            ],
          },
          { name: "responsavel", label: "Responsável", type: "text" },
          { name: "data_decisao", label: "Data da decisão", type: "date" },
          { name: "impacto_financeiro", label: "Impacto financeiro (R$)", type: "number", step: "0.01" },
        ]}
        columns={[
          { key: "titulo", label: "Decisão" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "status", label: "Status" },
          { key: "responsavel", label: "Responsável" },
          { key: "data_decisao", label: "Data", format: (v) => fmtDate(v) },
          { key: "impacto_financeiro", label: "Impacto", format: (v) => fmtBRL(Number(v)) },
        ]}
      />
    </AppShell>
  );
}
