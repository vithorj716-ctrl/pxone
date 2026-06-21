import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/investor")({
  head: () => ({ meta: [{ title: "PXOne — Investor Room" }] }),
  component: () => (
    <ModulePlaceholder
      title="Investor Room"
      subtitle="Sala virtual de investidores"
      description="Apresentações institucionais, pitch decks, business plans e relatórios exportáveis para potenciais investidores."
      bullets={[
        "Pitch decks versionados",
        "Business plans exportáveis (PDF)",
        "Indicadores executivos atualizados",
        "Relatórios trimestrais e anuais",
        "Apresentações institucionais",
        "Controle de acesso por investidor",
      ]}
    />
  ),
});
