import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CrudTable } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "PX Platform — Empresas do Grupo" }] }),
  component: EmpresasPage,
});

const SEGMENTOS = [
  { value: "transportadora", label: "Transportadora" },
  { value: "distribuidora", label: "Distribuidora" },
  { value: "farmacia", label: "Farmácia" },
  { value: "comercio", label: "Comércio" },
  { value: "servicos", label: "Serviços" },
  { value: "industria", label: "Indústria" },
  { value: "outro", label: "Outro" },
];

function EmpresasPage() {
  return (
    <AppShell title="Empresas do Grupo" subtitle="Cadastro e identidade das empresas da PX Platform">
      <CrudTable
        table="empresas"
        orderBy="nome"
        orderAsc
        trackUser={false}
        defaults={{ ativo: true, situacao: "ativa", configuracoes: {} }}
        fields={[
          { name: "codigo", label: "Código", type: "text", required: true, placeholder: "Ex: PXLOG" },
          { name: "nome", label: "Nome", type: "text", required: true },
          { name: "nome_fantasia", label: "Nome Fantasia", type: "text" },
          { name: "razao_social", label: "Razão Social", type: "text" },
          { name: "cnpj", label: "CNPJ", type: "text", placeholder: "00.000.000/0000-00" },
          { name: "segmento", label: "Segmento", type: "select", options: SEGMENTOS },
          { name: "logo_url", label: "Logo (URL)", type: "text", placeholder: "https://...", colSpan: 2 },
          { name: "cor_primaria", label: "Cor primária", type: "text", placeholder: "#3B82F6" },
          { name: "cor_secundaria", label: "Cor secundária", type: "text", placeholder: "#0EA5E9" },
          { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
          {
            name: "situacao",
            label: "Situação",
            type: "select",
            options: [
              { value: "ativa", label: "Ativa" },
              { value: "inativa", label: "Inativa" },
              { value: "suspensa", label: "Suspensa" },
            ],
          },
          {
            name: "ativo",
            label: "Status",
            type: "select",
            options: [
              { value: "true", label: "Ativa" },
              { value: "false", label: "Inativa" },
            ],
          },
        ]}
        columns={[
          {
            key: "logo_url",
            label: "",
            format: (v, row: any) =>
              v ? (
                <img src={v} alt="" className="size-7 rounded object-cover" />
              ) : (
                <div
                  className="size-7 rounded flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: row?.cor_primaria || "var(--gradient-brand)" }}
                >
                  {(row?.codigo || row?.nome || "?").slice(0, 2).toUpperCase()}
                </div>
              ),
          },
          { key: "codigo", label: "Código", className: "font-mono text-xs" },
          { key: "nome_fantasia", label: "Nome", format: (v, row: any) => v || row?.nome },
          { key: "segmento", label: "Segmento", format: (v) => v ?? "—" },
          { key: "cnpj", label: "CNPJ", format: (v) => v ?? "—" },
          {
            key: "situacao",
            label: "Situação",
            format: (v) => (
              <span className={`text-xs px-2 py-0.5 rounded ${v === "ativa" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {v || "—"}
              </span>
            ),
          },
        ]}
      />
    </AppShell>
  );
}
