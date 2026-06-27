import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrudTable } from "@/lib/crud";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tms/tabela-frete")({
  head: () => ({ meta: [{ title: "PXLog — Tabela de Fretes" }] }),
  component: TabelaFretePage,
});

function TabelaFretePage() {
  const [clientes, setClientes] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tms_clientes").select("id, nome").order("nome");
      setClientes(((data ?? []) as any[]).map((c) => ({ value: c.id, label: c.nome })));
    })();
  }, []);

  return (
    <AppShell title="Tabela de Fretes" subtitle="Regras de precificação por cliente, rota e faixas">
      <CrudTable
        table="tms_tabela_frete"
        orderBy="nome"
        orderAsc
        trackUser={false}
        defaults={{ ativo: true, tipo_cobranca: "peso", prazo_dias: 1 }}
        fields={[
          { name: "nome", label: "Nome da regra", type: "text", required: true, colSpan: 2 },
          { name: "cliente_id", label: "Cliente (opcional)", type: "select", options: [{ value: "", label: "— Qualquer —" }, ...clientes] },
          {
            name: "tipo_cobranca", label: "Cobrança", type: "select",
            options: [
              { value: "peso", label: "Peso (R$/kg)" },
              { value: "cubagem", label: "Cubagem (R$/m³)" },
              { value: "mista", label: "Mista" },
            ],
          },
          { name: "origem", label: "Origem", type: "text", placeholder: "Goiânia" },
          { name: "destino", label: "Destino", type: "text", placeholder: "Brasília" },
          { name: "valor_kg", label: "R$/kg", type: "number", step: "0.01" },
          { name: "valor_m3", label: "R$/m³", type: "number", step: "0.01" },
          { name: "valor_coleta", label: "Taxa coleta", type: "number", step: "0.01" },
          { name: "valor_entrega", label: "Taxa entrega", type: "number", step: "0.01" },
          { name: "valor_minimo", label: "Frete mínimo", type: "number", step: "0.01" },
          { name: "prazo_dias", label: "Prazo (dias)", type: "number" },
          { name: "faixa_peso_min", label: "Peso mín (kg)", type: "number", step: "0.01" },
          { name: "faixa_peso_max", label: "Peso máx (kg)", type: "number", step: "0.01" },
        ]}
        columns={[
          { key: "nome", label: "Regra" },
          { key: "origem", label: "Origem", format: (v) => v ?? "—" },
          { key: "destino", label: "Destino", format: (v) => v ?? "—" },
          { key: "tipo_cobranca", label: "Cobrança" },
          { key: "valor_kg", label: "R$/kg", format: (v) => Number(v).toFixed(2) },
          { key: "valor_m3", label: "R$/m³", format: (v) => Number(v).toFixed(2) },
          { key: "valor_minimo", label: "Mínimo", format: (v) => Number(v).toFixed(2) },
          { key: "prazo_dias", label: "Prazo" },
        ]}
      />
    </AppShell>
  );
}
