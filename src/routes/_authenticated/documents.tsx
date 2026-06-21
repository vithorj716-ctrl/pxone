import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "PXOne — Document Center" }] }),
  component: () => (
    <ModulePlaceholder
      title="Document Center"
      subtitle="Contratos, atas e documentos estratégicos"
      description="Repositório versionado de toda documentação estratégica do Grupo PX."
      bullets={[
        "Contratos com clientes, fornecedores e bancos",
        "Atas de reuniões societárias",
        "Planejamentos estratégicos versionados",
        "Apresentações institucionais",
        "Pareceres jurídicos e fiscais",
        "Controle de acesso por papel",
      ]}
    />
  ),
});
