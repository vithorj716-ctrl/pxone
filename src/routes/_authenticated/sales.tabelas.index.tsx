import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Table2, Copy, Archive, Loader2 } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { listTabelas, saveTabela, duplicarTabela, setStatusTabela } from "@/lib/pxsales-tabelas.functions";
import { listSalesClientes } from "@/lib/pxsales-clientes.functions";

export const Route = createFileRoute("/_authenticated/sales/tabelas/")({
  head: () => ({
    meta: [
      { title: "PXSales — Tabelas comerciais | Grupo PX" },
      {
        name: "description",
        content: "Tabelas comerciais versionadas por cliente, com componentes de frete, taxas e vigência.",
      },
      { property: "og:title", content: "PXSales — Tabelas comerciais" },
      { property: "og:description", content: "Monte tabelas de frete personalizadas por cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TabelasPage,
});

const TIPOS = [
  { v: "cliente", l: "Cliente" },
  { v: "campanha", l: "Campanha" },
  { v: "balcao", l: "Balcão / padrão" },
  { v: "regiao", l: "Região" },
];

const corStatus: Record<string, string> = {
  ativa: "bg-emerald-500/10 text-emerald-600",
  inativa: "bg-amber-500/10 text-amber-600",
  arquivada: "bg-muted text-muted-foreground",
};

function TabelasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { empresa } = useEmpresaAtiva();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);

  const fetchTabelas = useServerFn(listTabelas);
  const { data, isLoading } = useQuery({
    queryKey: ["pxsales", "tabelas", empresa?.id ?? null, search, status],
    queryFn: () => fetchTabelas({ data: { empresa_id: empresa?.id ?? null, search, status: status || undefined } }),
  });

  const duplicar = useServerFn(duplicarTabela);
  const arquivar = useServerFn(setStatusTabela);

  async function onDuplicar(id: string) {
    try {
      const r = await duplicar({ data: { id } });
      toast.success("Tabela duplicada.");
      navigate({ to: "/sales/tabelas/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível duplicar.");
    }
  }

  async function onArquivar(id: string) {
    try {
      await arquivar({ data: { id, status: "arquivada" } });
      toast.success("Tabela arquivada.");
      qc.invalidateQueries({ queryKey: ["pxsales", "tabelas"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível arquivar.");
    }
  }

  return (
    <PxSalesShell
      title="Tabelas comerciais"
      subtitle="Tabelas versionadas por cliente, com os componentes que você escolher"
      headerActions={
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="size-4 mr-1" /> Nova tabela
        </Button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar tabela pelo nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md bg-background ring-1 ring-border px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ativa">Ativas</option>
          <option value="inativa">Inativas</option>
          <option value="arquivada">Arquivadas</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando tabelas…
        </div>
      ) : !data?.length ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <Table2 className="size-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm">Nenhuma tabela comercial criada ainda.</p>
          <Button size="sm" className="mt-3" onClick={() => setNovaOpen(true)}>
            Criar a primeira tabela
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <div key={t.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/sales/tabelas/$id"
                  params={{ id: t.id }}
                  className="text-sm font-medium hover:underline break-words"
                >
                  {t.nome}
                </Link>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${corStatus[t.status] ?? ""}`}>{t.status}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {TIPOS.find((x) => x.v === t.tipo)?.l ?? t.tipo}
                {t.portal_visivel ? " · visível no portal" : " · oculta no portal"}
              </div>
              {t.descricao && <div className="text-[11px] text-muted-foreground line-clamp-2">{t.descricao}</div>}
              <div className="flex gap-1.5 mt-auto pt-2">
                <Button size="sm" variant="secondary" onClick={() => onDuplicar(t.id)}>
                  <Copy className="size-3.5 mr-1" /> Duplicar
                </Button>
                {t.status !== "arquivada" && (
                  <Button size="sm" variant="ghost" onClick={() => onArquivar(t.id)}>
                    <Archive className="size-3.5 mr-1" /> Arquivar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NovaTabelaDialog open={novaOpen} onOpenChange={setNovaOpen} />
    </PxSalesShell>
  );
}

function NovaTabelaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { empresa } = useEmpresaAtiva();
  const [form, setForm] = useState<Record<string, any>>({
    nome: "",
    tipo: "cliente",
    cliente_id: "",
    descricao: "",
    portal_visivel: false,
    portal_mostrar_componentes: true,
    portal_mostrar_valores: false,
  });
  const [salvando, setSalvando] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");

  const fetchClientes = useServerFn(listSalesClientes);
  const { data: clientes } = useQuery({
    queryKey: ["pxsales", "clientes-select", buscaCliente],
    queryFn: () => fetchClientes({ data: { search: buscaCliente, pageSize: 30 } }),
    enabled: open,
  });

  const salvar = useServerFn(saveTabela);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function onSalvar() {
    if (!form["nome"].trim()) return toast.error("Informe o nome da tabela.");
    if (form["tipo"] === "cliente" && !form["cliente_id"]) return toast.error("Selecione o cliente da tabela.");
    setSalvando(true);
    try {
      const r = await salvar({
        data: { ...form, cliente_id: form["cliente_id"] || null, empresa_id: empresa?.id ?? null },
      });
      toast.success("Tabela criada. Monte agora os componentes da versão 1.");
      onOpenChange(false);
      navigate({ to: "/sales/tabelas/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar a tabela.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tabela comercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form["nome"]} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Tabela Cliente X — SP/MG" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <select
                className="h-10 w-full rounded-md bg-background ring-1 ring-border px-3 text-sm"
                value={form["tipo"]}
                onChange={(e) => set("tipo", e.target.value)}
              >
                {TIPOS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Input
                placeholder="Buscar cliente"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
              />
            </div>
          </div>
          <select
            className="h-10 w-full rounded-md bg-background ring-1 ring-border px-3 text-sm"
            value={form["cliente_id"]}
            onChange={(e) => set("cliente_id", e.target.value)}
          >
            <option value="">Sem cliente específico (tabela geral)</option>
            {(clientes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.razao_social ?? c.nome_fantasia}
              </option>
            ))}
          </select>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form["descricao"]} onChange={(e) => set("descricao", e.target.value)} rows={2} />
          </div>
          <div className="space-y-2 rounded-lg ring-1 ring-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs">Mostrar esta tabela no portal do cliente</span>
              <Switch checked={form["portal_visivel"]} onCheckedChange={(v) => set("portal_visivel", v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Mostrar os componentes no portal</span>
              <Switch
                checked={form["portal_mostrar_componentes"]}
                onCheckedChange={(v) => set("portal_mostrar_componentes", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Mostrar os valores no portal</span>
              <Switch checked={form["portal_mostrar_valores"]} onCheckedChange={(v) => set("portal_mostrar_valores", v)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvando}>
            {salvando && <Loader2 className="size-4 mr-1 animate-spin" />} Criar tabela
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
