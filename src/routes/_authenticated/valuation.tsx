import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/valuation")({
  head: () => ({ meta: [{ title: "PXOne — Valuation Engine" }] }),
  component: () => (
    <ModulePlaceholder
      title="Valuation Engine"
      subtitle="Avaliação de empresas e do grupo consolidado"
      description="Motor de valuation com múltiplas metodologias para cada empresa do Grupo PX e o valor consolidado."
      bullets={[
        "Valuation por EBITDA (múltiplos de mercado)",
        "Fluxo de Caixa Descontado (DCF) com WACC dinâmico",
        "Valuation Patrimonial e por Múltiplos Comparáveis",
        "Valor individual de PXLog, PXMed e PXFarma",
        "Consolidação automática do valor do grupo",
        "Histórico e variação trimestral do valuation",
      ]}
    />
  ),
});
