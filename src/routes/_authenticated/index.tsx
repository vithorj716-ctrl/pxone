import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "PXOne — Executive Command Center" }] }),
  component: ExecutiveCommandCenter,
});

interface Custo { valor: number; status: string; empresa_id: string | null }
interface Empresa { id: string; codigo: string; nome: string }

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function ExecutiveCommandCenter() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("custos").select("valor,status,empresa_id"),
    ]).then(([e, c]) => {
      if (e.data) setEmpresas(e.data);
      if (c.data) setCustos(c.data as Custo[]);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    const total = custos.reduce((s, c) => s + Number(c.valor || 0), 0);
    const pend = custos
      .filter((c) => c.status === "pendente")
      .reduce((s, c) => s + Number(c.valor || 0), 0);
    const apr = custos
      .filter((c) => c.status === "aprovado")
      .reduce((s, c) => s + Number(c.valor || 0), 0);
    return { total, pend, apr };
  }, [custos]);

  const porEmpresa = useMemo(() => {
    return empresas.map((e) => {
      const valor = custos
        .filter((c) => c.empresa_id === e.id)
        .reduce((s, c) => s + Number(c.valor || 0), 0);
      return { ...e, valor };
    });
  }, [empresas, custos]);

  return (
    <AppShell
      title="Executive Command Center"
      subtitle="Visão consolidada com base em dados reais"
    >
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Empresas cadastradas" value={empresas.length.toString()} />
        <KpiCard label="Lançamentos de custo" value={custos.length.toString()} />
        <KpiCard label="Aguardando aprovação" value={fmtBRL(totals.pend)} />
        <KpiCard label="Custos aprovados" value={fmtBRL(totals.apr)} />
      </section>

      <section className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">Custos por empresa</h3>
          <Link to="/custos" className="text-xs text-muted-foreground hover:text-foreground">
            Ir para Central de Custos →
          </Link>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : empresas.length === 0 ? (
          <EmptyState text="Nenhuma empresa cadastrada ainda." />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-medium">Empresa</th>
                <th className="px-6 py-3 font-medium">Código</th>
                <th className="px-6 py-3 font-medium text-right">Custos lançados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {porEmpresa.map((e) => (
                <tr key={e.id} className="text-sm">
                  <td className="px-6 py-3 font-medium">{e.nome}</td>
                  <td className="px-6 py-3 text-muted-foreground">{e.codigo}</td>
                  <td className="px-6 py-3 text-right font-mono">{fmtBRL(e.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-surface ring-1 ring-border rounded-xl p-6">
        <h3 className="text-sm font-medium mb-2">Status do sistema</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          O PXOne não simula dados. Indicadores serão gerados conforme você lançar
          custos, planos e métricas reais. Comece pela{" "}
          <Link to="/custos" className="text-brand hover:underline">Central de Custos</Link>{" "}
          ou pelo <Link to="/business-plan" className="text-brand hover:underline">Business Plan</Link>.
        </p>
      </section>
    </AppShell>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 bg-surface ring-1 ring-border rounded-xl">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <h2 className="text-2xl font-medium tracking-tight mt-2">{value}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-12 text-center text-sm text-muted-foreground">{text}</div>;
}
