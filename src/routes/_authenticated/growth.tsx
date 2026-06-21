import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/growth")({
  head: () => ({ meta: [{ title: "PXOne — Growth Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="Growth Center"
      subtitle="Motor de crescimento e expansão"
      description="Projeções de crescimento, análise de capacidade operacional e identificação de oportunidades."
      bullets={[
        "Projeções de crescimento por unidade",
        "Capacidade operacional vs demanda",
        "Mapa de oportunidades regionais",
        "Análise de mercados adjacentes",
        "Pipeline de M&A potenciais",
        "Simulações de cenários de expansão",
      ]}
    />
  ),
});
