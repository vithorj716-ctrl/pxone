import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TmsShell } from "@/components/tms/tms-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Pencil } from "lucide-react";
import { NovoClienteDialog } from "@/components/registry/novo-cliente-dialog";
import { CATEGORIAS_CLIENTE, listClientes } from "@/lib/px-registry.functions";
import { formatCnpj } from "@/lib/cnpj";

export const Route = createFileRoute("/_authenticated/tms/clientes")({
  head: () => ({ meta: [{ title: "PXLog — Clientes" }] }),
  component: TmsClientesPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

function TmsClientesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const fn = useServerFn(listClientes);

  async function reload() {
    setLoading(true);
    try {
      const data = await fn({ data: { search: search || undefined, categoria: categoria || undefined, sistema: "pxlog" } });
      setRows(data as any[]);
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <TmsShell title="Clientes" subtitle="Cadastro único — PX Registry">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") reload(); }}
            placeholder="Buscar por razão social, fantasia ou CNPJ"
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
        <Button variant="outline" onClick={reload}>Filtrar</Button>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-2" /> Novo cliente</Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Razão Social</th>
              <th className="text-left px-3 py-2">CNPJ</th>
              <th className="text-left px-3 py-2">Cidade/UF</th>
              <th className="text-left px-3 py-2">Categorias</th>
              <th className="text-left px-3 py-2">Contato</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                <Users className="size-6 mx-auto mb-2 opacity-50" />
                Nenhum cliente vinculado ao PXLog. Clique em <strong>Novo cliente</strong>.
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-white/5">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.razao_social || r.nome_fantasia || "—"}</div>
                  {r.nome_fantasia && r.nome_fantasia !== r.razao_social && (
                    <div className="text-xs text-muted-foreground">{r.nome_fantasia}</div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.cnpj ? formatCnpj(r.cnpj) : "—"}</td>
                <td className="px-3 py-2">{[r.cidade, r.uf].filter(Boolean).join("/") || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(r.categorias ?? []).map((c: string) => (
                      <span key={c} className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {CATEGORIAS_CLIENTE.find((x) => x.value === c)?.label ?? c}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.contato_nome || "—"}
                  {r.telefone && <div className="text-muted-foreground">{r.telefone}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NovoClienteDialog
        open={open}
        onOpenChange={setOpen}
        sistema="pxlog"
        onSaved={() => reload()}
      />
    </TmsShell>
  );
}
