import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/kpis")({
  head: () => ({ meta: [{ title: "PXOne — KPI Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="KPI Center"
      subtitle="Indicadores financeiros, comerciais, operacionais e estratégicos"
      description="Catálogo completo de KPIs do grupo com metas, tendências, alertas e histórico auditável."
      bullets={[
        "KPIs financeiros (Receita, EBITDA, Margem, Caixa)",
        "KPIs comerciais (Pipeline, conversão, churn)",
        "KPIs operacionais (capacidade, ocupação, lead time)",
        "KPIs estratégicos vinculados aos OKRs",
        "Metas e thresholds com alertas automáticos",
        "Histórico mensal com benchmarks",
      ]}
    />
  ),
});
