import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/payback")({
  head: () => ({ meta: [{ title: "PXOne — Payback Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="Payback Center"
      subtitle="Simulações de investimento e tempo de retorno"
      description="Simule qualquer investimento estratégico e visualize payback, TIR, VPL e impacto no valuation."
      bullets={[
        "Aquisição de caminhões e frota",
        "Abertura de novas filiais e CDs",
        "Contratação de equipes estratégicas",
        "Aquisição de estoques e capital de giro",
        "Expansão de farmácias",
        "Cenários comparativos lado a lado",
      ]}
    />
  ),
});
