import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtBRL } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/growth")({
  head: () => ({ meta: [{ title: "PXOne — Growth Center" }] }),
  component: GrowthPage,
});

function GrowthPage() {
  const empresas = useEmpresas();
  return (
    <AppShell title="Growth Center" subtitle="Iniciativas de crescimento e expansão">
      <CrudTable
        table="growth_initiatives"
        title="Iniciativas"
        fields={[
          { name: "titulo", label: "Título", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "tipo",
            label: "Tipo",
            type: "select",
            options: [
              { value: "expansao", label: "Expansão geográfica" },
              { value: "produto", label: "Novo produto/serviço" },
              { value: "ma", label: "M&A" },
              { value: "capacidade", label: "Aumento de capacidade" },
              { value: "mercado", label: "Novo mercado" },
            ],
          },
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "planejada", label: "Planejada" },
              { value: "em_execucao", label: "Em execução" },
              { value: "concluida", label: "Concluída" },
              { value: "pausada", label: "Pausada" },
            ],
          },
          { name: "investimento", label: "Investimento (R$)", type: "number", step: "0.01" },
          { name: "retorno_projetado", label: "Retorno projetado (R$)", type: "number", step: "0.01" },
          { name: "prazo_meses", label: "Prazo (meses)", type: "number" },
        ]}
        columns={[
          { key: "titulo", label: "Iniciativa" },
          { key: "tipo", label: "Tipo" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "status", label: "Status" },
          { key: "investimento", label: "Invest.", format: (v) => fmtBRL(Number(v)) },
          { key: "retorno_projetado", label: "Retorno proj.", format: (v) => fmtBRL(Number(v)) },
          { key: "prazo_meses", label: "Prazo" },
        ]}
      />
    </AppShell>
  );
}
