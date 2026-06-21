import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "PXOne — Empresas do Grupo" }] }),
  component: EmpresasPage,
});

function EmpresasPage() {
  return (
    <AppShell title="Empresas do Grupo" subtitle="Cadastro e gestão das empresas">
      <CrudTable
        table="empresas"
        orderBy="nome"
        orderAsc
        trackUser={false}
        defaults={{ ativo: true }}
        fields={[
          { name: "codigo", label: "Código", type: "text", required: true, placeholder: "Ex: PXLOG" },
          { name: "nome", label: "Nome", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "ativo",
            label: "Status",
            type: "select",
            options: [
              { value: "true", label: "Ativa" },
              { value: "false", label: "Inativa" },
            ],
          },
        ]}
        columns={[
          { key: "codigo", label: "Código", className: "font-mono text-xs" },
          { key: "nome", label: "Nome" },
          { key: "descricao", label: "Descrição", format: (v) => v ?? "—" },
          {
            key: "ativo",
            label: "Status",
            format: (v) => (
              <span className={`text-xs px-2 py-0.5 rounded ${v ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {v ? "Ativa" : "Inativa"}
              </span>
            ),
          },
        ]}
      />
    </AppShell>
  );
}
