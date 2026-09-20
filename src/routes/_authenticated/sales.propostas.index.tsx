import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, FileSignature } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { listPropostas } from "@/lib/pxsales-cotacoes.functions";
import { STATUS_PROPOSTA } from "@/pxsales/frete-calc";

export const Route = createFileRoute("/_authenticated/sales/propostas/")({
  head: () => ({
    meta: [
      { title: "PXSales — Propostas | Grupo PX" },
      { name: "description", content: "Propostas comerciais enviadas, visualizadas, aceitas ou recusadas." },
      { property: "og:title", content: "PXSales — Propostas" },
      { property: "og:description", content: "Propostas comerciais e seus status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropostasPage,
});

const brl = (v: any) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const corProposta: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-500/10 text-blue-600",
  visualizada: "bg-indigo-500/10 text-indigo-600",
  negociacao: "bg-amber-500/10 text-amber-600",
  aceita: "bg-emerald-500/10 text-emerald-600",
  recusada: "bg-red-500/10 text-red-600",
  expirada: "bg-orange-500/10 text-orange-600",
  cancelada: "bg-muted text-muted-foreground",
};

function PropostasPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const fn = useServerFn(listPropostas);

  const { data: propostas = [], isLoading } = useQuery({
    queryKey: ["pxsales", "propostas", search, status],
    queryFn: () => fn({ data: { search: search || undefined, status: status || undefined } }),
  });

  const aceitas = propostas.filter((p) => p.status === "aceita");
  const emAberto = propostas.filter((p) => ["enviada", "visualizada", "negociacao"].includes(p.status));

  return (
    <PxSalesShell title="Propostas" subtitle="Envio e aceite">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Propostas" valor={String(propostas.length)} />
          <Kpi label="Em negociação" valor={String(emAberto.length)} />
          <Kpi label="Aceitas" valor={String(aceitas.length)} />
          <Kpi label="Valor aceito" valor={brl(aceitas.reduce((s, p) => s + Number(p.valor_total ?? 0), 0))} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Empresa ou título" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todas as situações</option>
            {STATUS_PROPOSTA.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando propostas…</p>
        ) : propostas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <FileSignature className="size-6 mx-auto mb-2 opacity-60" />
            Nenhuma proposta ainda. Crie uma cotação e use “Gerar proposta”.
          </div>
        ) : (
          <div className="grid gap-3">
            {propostas.map((p) => (
              <Link
                key={p.id}
                to="/sales/propostas/$id"
                params={{ id: p.id }}
                className="rounded-lg border p-4 hover:bg-accent/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">nº {p.numero} — {p.titulo}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {p.empresa_nome}
                      {p.validade_ate ? ` · válida até ${new Date(`${p.validade_ate}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                      {p.minuta_id ? " · embarque criado no PXLog" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{brl(p.valor_total)}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs ${corProposta[p.status] ?? "bg-muted"}`}>
                      {STATUS_PROPOSTA.find((s) => s.value === p.status)?.label ?? p.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
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
