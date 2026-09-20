import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRelatorioComercial } from "@/lib/pxsales-relatorios.functions";

export const Route = createFileRoute("/_authenticated/sales/relatorios")({
  head: () => ({
    meta: [
      { title: "PXSales — Relatórios comerciais | Grupo PX" },
      { name: "description", content: "Desempenho por vendedor, por cliente, por mês e motivos de perda." },
      { property: "og:title", content: "PXSales — Relatórios comerciais" },
      { property: "og:description", content: "Desempenho comercial por vendedor, cliente e período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosPage,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RelatoriosPage() {
  const fn = useServerFn(getRelatorioComercial);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pxsales", "relatorio", de, ate],
    queryFn: () => fn({ data: { de: de || undefined, ate: ate || undefined } }),
  });

  function exportar() {
    if (!data) return;
    const linhas = [
      "Vendedor;Propostas;Aceitas;Valor ganho;Comissao",
      ...data.por_responsavel.map((r) => `${r.nome};${r.propostas};${r.aceitas};${r.valor.toFixed(2)};${r.comissao.toFixed(2)}`),
      "",
      "Cliente;Propostas;Valor",
      ...data.por_cliente.map((c) => `${c.empresa_nome};${c.propostas};${c.valor.toFixed(2)}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([linhas], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pxsales-relatorio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PxSalesShell title="Relatórios" subtitle="Desempenho comercial">
      <div className="space-y-4">
        <div className="rounded-xl border p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportar} disabled={!data}>
            <Download className="size-4 mr-1.5" /> Exportar planilha
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando…</p>
        ) : !data ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <BarChart3 className="size-6 mx-auto mb-2 opacity-60" /> Sem dados no período.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloco titulo="Por vendedor">
              <Tabela
                cabecalho={["Vendedor", "Propostas", "Ganhas", "Valor", "Comissão"]}
                linhas={data.por_responsavel.map((r) => [r.nome, String(r.propostas), String(r.aceitas), brl(r.valor), brl(r.comissao)])}
              />
            </Bloco>
            <Bloco titulo="Top clientes">
              <Tabela
                cabecalho={["Cliente", "Propostas", "Valor"]}
                linhas={data.por_cliente.map((c) => [c.empresa_nome, String(c.propostas), brl(c.valor)])}
              />
            </Bloco>
            <Bloco titulo="Por mês">
              <Tabela
                cabecalho={["Mês", "Propostas", "Ganhas", "Valor ganho"]}
                linhas={data.por_mes.map((m) => [m.mes, String(m.propostas), String(m.aceitas), brl(m.valor)])}
              />
            </Bloco>
            <Bloco titulo="Motivos de perda">
              <Tabela cabecalho={["Motivo", "Ocorrências"]} linhas={data.motivos_perda.map((m) => [m.motivo, String(m.qtd)])} />
            </Bloco>
          </div>
        )}
      </div>
    </PxSalesShell>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-sm font-medium mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  if (!linhas.length) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {cabecalho.map((c) => <th key={c} className="py-1.5 pr-3 font-normal">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t">
              {l.map((c, j) => <td key={j} className="py-1.5 pr-3 tabular-nums">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
