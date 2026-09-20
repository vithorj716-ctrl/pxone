import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle, Phone, Search, Users } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { listSalesContatos } from "@/lib/pxsales-clientes.functions";
import { SETORES_CONTATO } from "@/lib/px-enderecos.functions";
import { onlyDigits } from "@/lib/cnpj";

export const Route = createFileRoute("/_authenticated/sales/contatos")({
  head: () => ({
    meta: [
      { title: "PXSales — Contatos | Grupo PX" },
      { name: "description", content: "Contatos comerciais por empresa, com setor, cargo e canais de contato." },
      { property: "og:title", content: "PXSales — Contatos" },
      { property: "og:description", content: "Contatos comerciais por empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesContatosPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

function SalesContatosPage() {
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("");
  const fn = useServerFn(listSalesContatos);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pxsales", "contatos", busca, setor],
    queryFn: () => fn({ data: { search: busca || undefined, setor: setor || undefined } }),
  });

  return (
    <PxSalesShell title="Contatos" subtitle="Pessoas por empresa">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setBusca(search); }}
            onBlur={() => setBusca(search)}
            placeholder="Buscar por nome, cargo, telefone ou e-mail"
            className="pl-8"
          />
        </div>
        <select
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os setores</option>
          {SETORES_CONTATO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando contatos…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <Users className="size-6 mx-auto text-muted-foreground" />
          <div className="text-sm font-medium mt-3">Nenhum contato encontrado</div>
          <p className="text-xs text-muted-foreground mt-1">
            Os contatos são cadastrados dentro da ficha de cada empresa, na aba Contatos.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c: any) => (
            <div key={c.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{c.nome}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[c.cargo, SETORES_CONTATO.find((s) => s.value === c.setor)?.label ?? c.setor].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {c.is_principal && (
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-brand/15 shrink-0">Principal</span>
                )}
              </div>

              {c.cliente && (
                <Link
                  to="/sales/clientes/$id"
                  params={{ id: c.cliente_id }}
                  className="mt-2 block text-[11px] text-muted-foreground hover:text-foreground truncate"
                >
                  {c.cliente.nome_fantasia || c.cliente.razao_social}
                </Link>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.telefone && (
                  <a href={`tel:${onlyDigits(c.telefone)}`} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60">
                    <Phone className="size-3" /> {c.telefone}
                  </a>
                )}
                {c.whatsapp && (
                  <a href={`https://wa.me/55${onlyDigits(c.whatsapp)}`} target="_blank" rel="noreferrer" className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60">
                    <MessageCircle className="size-3" /> WhatsApp
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60 truncate max-w-full">
                    <Mail className="size-3" /> {c.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PxSalesShell>
  );
}
