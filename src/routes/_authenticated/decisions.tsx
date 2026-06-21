import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({ meta: [{ title: "PXOne — Decision Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="Decision Center"
      subtitle="Governança e decisões societárias"
      description="Registro auditável de todas as decisões estratégicas com votação entre sócios e análise de impacto."
      bullets={[
        "Registro formal de decisões societárias",
        "Sistema de votação entre sócios",
        "Análise de impacto financeiro projetado",
        "Histórico auditável com versionamento",
        "Anexos: contratos, atas, pareceres",
        "Alertas de decisões pendentes",
      ]}
    />
  ),
});
