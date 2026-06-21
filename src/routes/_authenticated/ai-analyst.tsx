import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/ai-analyst")({
  head: () => ({ meta: [{ title: "PXOne — AI Business Analyst" }] }),
  component: () => (
    <ModulePlaceholder
      title="AI Business Analyst"
      subtitle="Assistente corporativo alimentado pelos dados do grupo"
      description="Assistente de IA com acesso a todos os indicadores do Grupo PX para responder perguntas estratégicas e gerar recomendações."
      bullets={[
        "Perguntas em linguagem natural sobre KPIs",
        "Geração de relatórios sob demanda",
        "Detecção automática de anomalias",
        "Recomendações estratégicas baseadas em dados",
        "Análise comparativa entre empresas",
        "Previsões e cenários simulados",
      ]}
    />
  ),
});
