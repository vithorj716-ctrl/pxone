import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/risk")({
  head: () => ({ meta: [{ title: "PXOne — Risk Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="Risk Center"
      subtitle="Mapa de riscos corporativos"
      description="Mapeamento e mitigação de riscos financeiros, tributários, jurídicos, regulatórios e operacionais."
      bullets={[
        "Matriz de risco: probabilidade × impacto",
        "Riscos financeiros e covenants bancários",
        "Riscos tributários e jurídicos",
        "Riscos regulatórios (saúde, farma, transporte)",
        "Planos de mitigação com responsáveis",
        "Histórico de incidentes e lições aprendidas",
      ]}
    />
  ),
});
