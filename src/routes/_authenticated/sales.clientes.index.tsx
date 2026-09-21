import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search, Star, Users, MapPin, Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NovoClienteDialog } from "@/components/registry/novo-cliente-dialog";
import { CATEGORIAS_CLIENTE } from "@/lib/px-registry.functions";
import { listSalesClientes, vincularClientePxSales } from "@/lib/pxsales-clientes.functions";
import { formatCnpj } from "@/lib/cnpj";

export const Route = createFileRoute("/_authenticated/sales/clientes/")({
  head: () => ({
    meta: [
      { title: "PXSales — Empresas | Grupo PX" },
      { name: "description", content: "Carteira de empresas e clientes comerciais do Grupo PX." },
      { property: "og:title", content: "PXSales — Empresas" },
      { property: "og:description", content: "Carteira de empresas e clientes comerciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesClientesPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const data = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

function SalesClientesPage() {
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [carteira, setCarteira] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const fn = useServerFn(listSalesClientes);
  const fnVincular = useServerFn(vincularClientePxSales);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pxsales", "clientes", busca, categoria, situacao],
    queryFn: () => fn({ data: { search: busca || undefined, categoria: categoria || undefined, situacao } }),
  });

  const lista = useMemo(() => (carteira ? rows.filter((r) => r.vinculado_pxsales) : rows), [rows, carteira]);

  const kpis = useMemo(() => {
    const ativos = rows.filter((r) => r.ativo);
    return {
      total: rows.length,
      carteira: rows.filter((r) => r.vinculado_pxsales).length,
      ativos: ativos.length,
      faturamento: rows.reduce((s, r) => s + r.faturamento_30d, 0),
    };
  }, [rows]);

  async function toggleCarteira(row: { id: string; vinculado_pxsales: boolean }) {
    try {
      await fnVincular({ data: { cliente_id: row.id, vincular: !row.vinculado_pxsales } });
      toast.success(row.vinculado_pxsales ? "Removida da carteira PXSales" : "Adicionada à carteira PXSales");
      void qc.invalidateQueries({ queryKey: ["pxsales", "clientes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar a carteira");
    }
  }

  return (
    <PxSalesShell
      title="Empresas"
      subtitle="Carteira comercial"
      headerActions={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/sales/clientes/importar"><FileUp className="size-4 mr-1.5" /> Importar XML</Link>
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Nova empresa
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Empresas cadastradas", value: String(kpis.total) },
          { label: "Na carteira PXSales", value: String(kpis.carteira) },
          { label: "Ativas", value: String(kpis.ativos) },
          { label: "Fretes últimos 30 dias", value: brl(kpis.faturamento) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl ring-1 ring-border bg-surface/30 p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
            <div className="text-lg font-semibold mt-1">{isLoading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setBusca(search); }}
            onBlur={() => setBusca(search)}
            placeholder="Buscar por CNPJ, razão social, fantasia ou cidade"
            className="pl-8"
          />
        </div>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS_CLIENTE.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={situacao}
          onChange={(e) => setSituacao(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="ativos">Ativas</option>
          <option value="inativos">Inativas</option>
          <option value="todos">Todas</option>
        </select>
        <button
          onClick={() => setCarteira((v) => !v)}
          className={`h-9 px-3 rounded-md text-sm ring-1 transition ${carteira ? "ring-transparent bg-brand/15 text-foreground" : "ring-border text-muted-foreground hover:text-foreground"}`}
        >
          <Star className={`size-3.5 mr-1.5 inline ${carteira ? "fill-current" : ""}`} /> Minha carteira
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando empresas…
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <Building2 className="size-6 mx-auto text-muted-foreground" />
          <div className="text-sm font-medium mt-3">Nenhuma empresa encontrada</div>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste a busca ou cadastre uma nova empresa pelo CNPJ — os dados são preenchidos automaticamente.
          </p>
          <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Nova empresa
          </Button>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((r) => (
            <div key={r.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/sales/clientes/$id"
                  params={{ id: r.id }}
                  className="min-w-0 group"
                >
                  <div className="font-medium text-sm truncate group-hover:underline">
                    {r.nome_fantasia || r.razao_social || formatCnpj(r.cnpj)}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{formatCnpj(r.cnpj)}</div>
                </Link>
                <button
                  onClick={() => toggleCarteira(r)}
                  title={r.vinculado_pxsales ? "Remover da carteira" : "Adicionar à carteira"}
                  className={`p-1.5 rounded-md shrink-0 ${r.vinculado_pxsales ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Star className={`size-4 ${r.vinculado_pxsales ? "fill-current" : ""}`} />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="size-3" />
                {r.cidade ? `${r.cidade}${r.uf ? `/${r.uf}` : ""}` : "Local não informado"}
                {!r.ativo && <span className="ml-1 text-destructive">· inativa</span>}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs font-semibold">{r.contatos}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Contatos</div>
                </div>
                <div>
                  <div className="text-xs font-semibold">{r.minutas}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Embarques</div>
                </div>
                <div>
                  <div className="text-xs font-semibold">{data(r.ultima_minuta)}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Último</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  30 dias: <strong className="text-foreground">{brl(r.faturamento_30d)}</strong>
                </span>
                <button
                  onClick={() => { setEditing(r); setOpen(true); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Editar cadastro
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Users className="size-3" /> Mesmo cadastro usado pelo PXOne e pelo PXLog — alterações aqui valem para toda a plataforma.
      </div>

      <NovoClienteDialog
        open={open}
        onOpenChange={setOpen}
        sistema="pxsales"
        initialCliente={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["pxsales", "clientes"] }); }}
      />
    </PxSalesShell>
  );
}
