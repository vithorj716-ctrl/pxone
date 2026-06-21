import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/okr")({
  head: () => ({ meta: [{ title: "PXOne — OKR Center" }] }),
  component: OkrPage,
});

function OkrPage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="OKR Center" subtitle="Objetivos e Key Results">
      <CrudTable
        table="okrs"
        title="Objetivos"
        fields={[
          { name: "objetivo", label: "Objetivo", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          { name: "trimestre", label: "Trimestre (ex: 2026-Q1)", type: "text" },
          { name: "responsavel", label: "Responsável", type: "text" },
          { name: "progresso", label: "Progresso (%)", type: "number" },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
        ]}
        columns={[
          { key: "objetivo", label: "Objetivo" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "trimestre", label: "Trimestre" },
          { key: "responsavel", label: "Responsável" },
          {
            key: "progresso",
            label: "Progresso",
            format: (v) => {
              const p = Math.min(100, Math.max(0, Number(v) || 0));
              return (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${p}%` }} />
                  </div>
                  <span className="text-xs">{p}%</span>
                </div>
              );
            },
          },
        ]}
      />
    </AppShell>
  );
}
