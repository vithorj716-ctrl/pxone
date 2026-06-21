import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({ meta: [{ title: "PXOne — Timeline Corporativa" }] }),
  component: () => (
    <ModulePlaceholder
      title="Timeline Corporativa"
      subtitle="Histórico completo de eventos do grupo"
      description="Linha do tempo institucional com marcos, investimentos, expansões e decisões relevantes."
      bullets={[
        "Marcos fundacionais de cada empresa",
        "Investimentos e aquisições",
        "Expansões geográficas",
        "Decisões societárias relevantes",
        "Conquistas e prêmios",
        "Histórico de valuation ao longo do tempo",
      ]}
    />
  ),
});
