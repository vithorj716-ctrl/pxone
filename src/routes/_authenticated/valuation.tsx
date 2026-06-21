import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrudTable, useEmpresas, fmtBRL } from "@/lib/crud";

export const Route = createFileRoute("/_authenticated/valuation")({
  head: () => ({ meta: [{ title: "PXOne — Valuation Engine" }] }),
  component: ValuationPage,
});

function ValuationPage() {
  const empresas = useEmpresas();
  const [rows, setRows] = useState<any[]>([]);

  const totalGrupo = rows.reduce((s, r) => s + (Number(r.valor_calculado) || 0), 0);
  const porEmpresa = empresas.map((e) => ({
    ...e,
    total: rows.filter((r) => r.empresa_id === e.id).reduce((s, r) => s + (Number(r.valor_calculado) || 0), 0),
  }));

  return (
    <AppShell title="Valuation Engine" subtitle="Avaliação de empresas e do grupo consolidado">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Modelos cadastrados" value={String(rows.length)} />
        <Kpi label="Valor consolidado do grupo" value={fmtBRL(totalGrupo)} />
        <Kpi label="Empresas avaliadas" value={String(porEmpresa.filter((e) => e.total > 0).length)} />
        <Kpi label="Maior valuation" value={fmtBRL(Math.max(0, ...rows.map((r) => Number(r.valor_calculado) || 0)))} />
      </div>

      <CrudTable
        table="valuation_models"
        title="Modelos de valuation"
        onDataChange={setRows}
        fields={[
          {
            name: "empresa_id",
            label: "Empresa",
            type: "select",
            required: true,
            options: empresas.map((e) => ({ value: e.id, label: e.nome })),
          },
          {
            name: "metodologia",
            label: "Metodologia",
            type: "select",
            required: true,
            options: [
              { value: "ebitda_multiplo", label: "EBITDA × Múltiplo" },
              { value: "dcf", label: "Fluxo de Caixa Descontado (DCF)" },
              { value: "patrimonial", label: "Patrimonial" },
              { value: "comparaveis", label: "Múltiplos Comparáveis" },
            ],
          },
          { name: "ano_base", label: "Ano base", type: "number" },
          { name: "ebitda", label: "EBITDA (R$)", type: "number", step: "0.01" },
          { name: "multiplo", label: "Múltiplo", type: "number", step: "0.01" },
          { name: "wacc", label: "WACC (%)", type: "number", step: "0.01" },
          { name: "fcf_anual", label: "FCF Anual (R$)", type: "number", step: "0.01" },
          { name: "crescimento_perpetuo", label: "Crescimento perpétuo (%)", type: "number", step: "0.01" },
          { name: "valor_calculado", label: "Valor calculado (R$)", type: "number", step: "0.01", required: true },
          { name: "premissas", label: "Premissas e observações", type: "textarea", colSpan: 2 },
        ]}
        columns={[
          {
            key: "empresa_id",
            label: "Empresa",
            format: (v) => empresas.find((e) => e.id === v)?.nome ?? "—",
          },
          { key: "metodologia", label: "Metodologia" },
          { key: "ano_base", label: "Ano" },
          { key: "ebitda", label: "EBITDA", format: (v) => fmtBRL(Number(v)) },
          { key: "multiplo", label: "Múltiplo", format: (v) => (v == null ? "—" : `${v}x`) },
          { key: "valor_calculado", label: "Valuation", format: (v) => fmtBRL(Number(v)) },
        ]}
      />

      <div className="bg-surface ring-1 ring-border rounded-xl p-6">
        <h3 className="text-sm font-medium mb-4">Consolidação por empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {porEmpresa.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-3">Nenhuma empresa cadastrada.</p>
          ) : (
            porEmpresa.map((e) => (
              <div key={e.id} className="p-4 rounded-lg bg-surface-2 ring-1 ring-border">
                <p className="text-xs text-muted-foreground">{e.codigo}</p>
                <p className="text-sm font-medium">{e.nome}</p>
                <p className="text-lg font-medium mt-2">{fmtBRL(e.total)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-medium mt-1">{value}</p>
    </div>
  );
}
