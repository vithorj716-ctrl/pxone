import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtDate } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({ meta: [{ title: "PXOne — Timeline Corporativa" }] }),
  component: TimelinePage,
});

function TimelinePage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="Timeline Corporativa" subtitle="Eventos institucionais do grupo">
      <CrudTable
        table="timeline_events"
        title="Eventos"
        orderBy="data_evento"
        fields={[
          { name: "titulo", label: "Título", type: "text", required: true },
          { name: "data_evento", label: "Data do evento", type: "date", required: true },
          {
            name: "tipo",
            label: "Tipo",
            type: "select",
            options: [
              { value: "fundacao", label: "Fundação" },
              { value: "investimento", label: "Investimento" },
              { value: "aquisicao", label: "Aquisição" },
              { value: "expansao", label: "Expansão" },
              { value: "premio", label: "Prêmio" },
              { value: "decisao", label: "Decisão" },
              { value: "outro", label: "Outro" },
            ],
          },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          { key: "data_evento", label: "Data", format: (v) => fmtDate(v) },
          { key: "titulo", label: "Evento" },
          { key: "tipo", label: "Tipo" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "descricao", label: "Descrição" },
        ]}
      />
    </AppShell>
  );
}
