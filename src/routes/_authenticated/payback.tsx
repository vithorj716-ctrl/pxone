import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtBRL } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/payback")({
  head: () => ({ meta: [{ title: "PXOne — Payback Center" }] }),
  component: PaybackPage,
});

function calcPayback(inv: number, retorno: number) {
  if (!retorno || retorno <= 0) return null;
  return inv / retorno;
}

function PaybackPage() {
  const empresas = useEmpresas();

  return (
    <AppShell title="Payback Center" subtitle="Simulações de investimento e retorno">
      <CrudTable
        table="payback_projects"
        title="Projetos de investimento"
        fields={[
          { name: "nome", label: "Nome do projeto", type: "text", required: true },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
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
              { value: "analise", label: "Em análise" },
              { value: "aprovado", label: "Aprovado" },
              { value: "execucao", label: "Em execução" },
              { value: "concluido", label: "Concluído" },
              { value: "cancelado", label: "Cancelado" },
            ],
          },
          { name: "investimento_inicial", label: "Investimento inicial (R$)", type: "number", step: "0.01", required: true },
          { name: "retorno_mensal", label: "Retorno mensal estimado (R$)", type: "number", step: "0.01", required: true },
          { name: "prazo_meses", label: "Prazo do projeto (meses)", type: "number" },
          { name: "taxa_desconto", label: "Taxa de desconto (% a.m.)", type: "number", step: "0.01" },
        ]}
        columns={[
          { key: "nome", label: "Projeto" },
          { key: "empresa_id", label: "Empresa", format: (v) => empresas.find((e) => e.id === v)?.codigo ?? "—" },
          { key: "status", label: "Status" },
          { key: "investimento_inicial", label: "Investimento", format: (v) => fmtBRL(Number(v)) },
          { key: "retorno_mensal", label: "Retorno/mês", format: (v) => fmtBRL(Number(v)) },
          {
            key: "id",
            label: "Payback (meses)",
            format: (_v, r) => {
              const p = calcPayback(Number(r.investimento_inicial), Number(r.retorno_mensal));
              return p == null ? "—" : <span className="font-medium">{p.toFixed(1)}</span>;
            },
          },
        ]}
      />
    </AppShell>
  );
}
