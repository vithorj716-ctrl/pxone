import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtNum } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/kpis")({
  head: () => ({ meta: [{ title: "PXOne — KPI Center" }] }),
  component: KpisPage,
});

function KpisPage() {
  const empresas = useEmpresas();

  return (
    <AppShell title="KPI Center" subtitle="Indicadores cadastrados pelo usuário">
      <CrudTable
        table="kpis"
        title="Indicadores"
        fields={[
          { name: "nome", label: "Nome do KPI", type: "text", required: true },
          {
            name: "categoria",
            label: "Categoria",
            type: "select",
            options: [
              { value: "financeiro", label: "Financeiro" },
              { value: "comercial", label: "Comercial" },
              { value: "operacional", label: "Operacional" },
              { value: "estrategico", label: "Estratégico" },
              { value: "rh", label: "RH" },
            ],
          },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          { name: "periodo", label: "Período (ex: 2026-Q1)", type: "text" },
          { name: "valor", label: "Valor atual", type: "number", step: "0.01" },
          { name: "meta", label: "Meta", type: "number", step: "0.01" },
          { name: "unidade", label: "Unidade (R$, %, un.)", type: "text" },
          { name: "observacoes", label: "Observações", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          { key: "nome", label: "KPI" },
          { key: "categoria", label: "Categoria" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "periodo", label: "Período" },
          { key: "valor", label: "Valor", format: (v, r) => `${fmtNum(Number(v))} ${r.unidade ?? ""}` },
          { key: "meta", label: "Meta", format: (v, r) => `${fmtNum(Number(v))} ${r.unidade ?? ""}` },
          {
            key: "id",
            label: "Atingimento",
            format: (_v, r) => {
              const meta = Number(r.meta) || 0;
              if (!meta) return "—";
              const pct = (Number(r.valor) / meta) * 100;
              return <span className={pct >= 100 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"}>{pct.toFixed(1)}%</span>;
            },
          },
        ]}
      />
    </AppShell>
  );
}
