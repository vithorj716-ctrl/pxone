import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtDate } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "PXOne — Documentos" }] }),
  component: DocsPage,
});

function DocsPage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="Documentos" subtitle="Repositório de documentos estratégicos">
      <CrudTable
        table="documents"
        title="Documentos"
        fields={[
          { name: "nome", label: "Nome", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "categoria",
            label: "Categoria",
            type: "select",
            options: [
              { value: "contrato", label: "Contrato" },
              { value: "ata", label: "Ata societária" },
              { value: "planejamento", label: "Planejamento" },
              { value: "apresentacao", label: "Apresentação" },
              { value: "parecer", label: "Parecer" },
              { value: "outro", label: "Outro" },
            ],
          },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          { name: "url", label: "URL do documento", type: "text", colSpan: 2, placeholder: "https://..." },
        ]}
        columns={[
          { key: "nome", label: "Documento" },
          { key: "categoria", label: "Categoria" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          {
            key: "url",
            label: "Link",
            format: (v) =>
              v ? (
                <a href={v} target="_blank" rel="noreferrer" className="text-brand hover:underline text-xs">
                  Abrir
                </a>
              ) : (
                "—"
              ),
          },
          { key: "created_at", label: "Criado em", format: (v) => fmtDate(v) },
        ]}
      />
    </AppShell>
  );
}
