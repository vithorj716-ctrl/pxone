import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/okr")({
  head: () => ({ meta: [{ title: "PXOne — OKR Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="OKR Center"
      subtitle="Objetivos e Key Results corporativos"
      description="Gestão de OKRs do grupo com cascateamento por empresa, área e responsável."
      bullets={[
        "Objetivos corporativos do Grupo PX",
        "Key Results mensuráveis por empresa",
        "Cascateamento até nível de gestor",
        "Tracking semanal de progresso",
        "Vinculação automática a KPIs",
        "Retrospectivas trimestrais",
      ]}
    />
  ),
});
