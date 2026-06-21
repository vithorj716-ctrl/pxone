import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/risk")({
  head: () => ({ meta: [{ title: "PXOne — Risk Center" }] }),
  component: RiskPage,
});

function RiskPage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="Risk Center" subtitle="Mapa de riscos corporativos">
      <CrudTable
        table="risks"
        title="Riscos identificados"
        fields={[
          { name: "titulo", label: "Título do risco", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "categoria",
            label: "Categoria",
            type: "select",
            options: [
              { value: "financeiro", label: "Financeiro" },
              { value: "tributario", label: "Tributário" },
              { value: "juridico", label: "Jurídico" },
              { value: "regulatorio", label: "Regulatório" },
              { value: "operacional", label: "Operacional" },
              { value: "estrategico", label: "Estratégico" },
            ],
          },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          { name: "probabilidade", label: "Probabilidade (1-5)", type: "number" },
          { name: "impacto", label: "Impacto (1-5)", type: "number" },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "aberto", label: "Aberto" },
              { value: "mitigando", label: "Em mitigação" },
              { value: "monitorando", label: "Monitorando" },
              { value: "fechado", label: "Fechado" },
            ],
          },
          { name: "responsavel", label: "Responsável", type: "text" },
          { name: "mitigacao", label: "Plano de mitigação", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          { key: "titulo", label: "Risco" },
          { key: "categoria", label: "Categoria" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "probabilidade", label: "Prob." },
          { key: "impacto", label: "Imp." },
          {
            key: "id",
            label: "Score",
            format: (_v, r) => {
              const s = (Number(r.probabilidade) || 0) * (Number(r.impacto) || 0);
              const color = s >= 16 ? "text-red-400" : s >= 9 ? "text-amber-400" : "text-emerald-400";
              return <span className={`font-medium ${color}`}>{s}</span>;
            },
          },
          { key: "status", label: "Status" },
          { key: "responsavel", label: "Responsável" },
        ]}
      />
    </AppShell>
  );
}
