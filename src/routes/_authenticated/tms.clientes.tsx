import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/tms/clientes")({
  head: () => ({ meta: [{ title: "PXLog — Clientes" }] }),
  component: () => (
    <AppShell title="Clientes TMS" subtitle="Cadastro de clientes do PXLog">
      <CrudTable
        table="tms_clientes"
        orderBy="nome"
        orderAsc
        trackUser={false}
        defaults={{ ativo: true }}
        fields={[
          { name: "nome", label: "Nome / Razão Social", type: "text", required: true, colSpan: 2 },
          { name: "cnpj", label: "CNPJ", type: "text" },
          { name: "contato", label: "Contato", type: "text" },
          { name: "telefone", label: "Telefone", type: "text" },
          { name: "email", label: "E-mail", type: "text" },
          { name: "cidade", label: "Cidade", type: "text" },
          { name: "uf", label: "UF", type: "text" },
          { name: "endereco", label: "Endereço", type: "text", colSpan: 2 },
          { name: "observacoes", label: "Observações", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "cnpj", label: "CNPJ", format: (v) => v ?? "—" },
          { key: "cidade", label: "Cidade" },
          { key: "uf", label: "UF" },
          { key: "telefone", label: "Telefone", format: (v) => v ?? "—" },
        ]}
      />
    </AppShell>
  ),
});
