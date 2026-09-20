import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileSpreadsheet } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { CotacaoDialog } from "@/components/pxsales/cotacao-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listCotacoes } from "@/lib/pxsales-cotacoes.functions";
import { STATUS_COTACAO } from "@/pxsales/frete-calc";

export const Route = createFileRoute("/_authenticated/sales/cotacoes/")({
  head: () => ({
    meta: [
      { title: "PXSales — Cotações | Grupo PX" },
      { name: "description", content: "Cotações de frete com tabela do PXLog, composição de valores e validade." },
      { property: "og:title", content: "PXSales — Cotações" },
      { property: "og:description", content: "Cotações de frete da operação logística." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotacoesPage,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const corStatus: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-500/10 text-blue-600",
  aprovada: "bg-emerald-500/10 text-emerald-600",
  recusada: "bg-red-500/10 text-red-600",
  expirada: "bg-amber-500/10 text-amber-600",
};

function CotacoesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const fn = useServerFn(listCotacoes);

  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["pxsales", "cotacoes", search, status],
    queryFn: () => fn({ data: { search: search || undefined, status: status || undefined } }),
  });

  const total = cotacoes.reduce((s, c) => s + Number(c.valor_total ?? 0), 0);
  const abertas = cotacoes.filter((c) => ["rascunho", "enviada"].includes(c.status)).length;

  return (
    <PxSalesShell title="Cotações" subtitle="Frete e serviços">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi label="Cotações" valor={String(cotacoes.length)} />
          <Kpi label="Em aberto" valor={String(abertas)} />
          <Kpi label="Valor cotado" valor={brl(total)} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Empresa, origem ou destino" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todas as situações</option>
            {STATUS_COTACAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1.5" /> Nova cotação</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando cotações…</p>
        ) : cotacoes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <FileSpreadsheet className="size-6 mx-auto mb-2 opacity-60" />
            Nenhuma cotação ainda. Crie a primeira e o valor é calculado pela tabela de frete da operação.
          </div>
        ) : (
          <div className="grid gap-3">
            {cotacoes.map((c) => (
              <Link
                key={c.id}
                to="/sales/cotacoes/$id"
                params={{ id: c.id }}
                className="rounded-lg border p-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      nº {c.numero} — {c.empresa_nome}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {(c.origem_cidade ?? "—")}/{c.origem_uf ?? "—"} → {(c.destino_cidade ?? "—")}/{c.destino_uf ?? "—"} · {c.tipo_operacao} · {c.prazo_dias} dia(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{brl(Number(c.valor_total))}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs ${corStatus[c.status] ?? "bg-muted"}`}>
                      {STATUS_COTACAO.find((s) => s.value === c.status)?.label ?? c.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CotacaoDialog open={open} onOpenChange={setOpen} />
    </PxSalesShell>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{valor}</p>
    </div>
  );
}
