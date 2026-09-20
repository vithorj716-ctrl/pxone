import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Loader2, Flame, Phone, Mail, ArrowRightLeft, Pencil, Trash2, Sparkles } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { LeadDialog } from "@/components/pxsales/lead-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listLeads,
  listPipelineEtapas,
  moverLeadEtapa,
  converterLead,
  excluirLead,
  type LeadRow,
} from "@/lib/pxsales-pipeline.functions";
import { formatCnpj } from "@/lib/cnpj";

export const Route = createFileRoute("/_authenticated/sales/leads")({
  head: () => ({
    meta: [
      { title: "PXSales — Leads | Grupo PX" },
      { name: "description", content: "Captação e qualificação de leads comerciais da operação logística." },
      { property: "og:title", content: "PXSales — Leads" },
      { property: "og:description", content: "Captação e qualificação de leads comerciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesLeadsPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

const brl = (v: number | null) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const TEMP_COR: Record<string, string> = {
  quente: "text-red-400",
  morno: "text-amber-400",
  frio: "text-sky-400",
};

function SalesLeadsPage() {
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const [status, setStatus] = useState("aberto");
  const [meus, setMeus] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRow | null>(null);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(listLeads);
  const fnEtapas = useServerFn(listPipelineEtapas);
  const fnMover = useServerFn(moverLeadEtapa);
  const fnConverter = useServerFn(converterLead);
  const fnExcluir = useServerFn(excluirLead);

  const { data: etapas = [] } = useQuery({ queryKey: ["pxsales", "etapas"], queryFn: () => fnEtapas(), staleTime: 300_000 });
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["pxsales", "leads", busca, etapa, status, meus],
    queryFn: () => fn({ data: { search: busca || undefined, etapa: etapa || undefined, status: status || undefined, meus } }),
  });

  const kpis = useMemo(() => {
    const abertos = leads.filter((l) => l.status === "aberto");
    return {
      total: leads.length,
      abertos: abertos.length,
      quentes: leads.filter((l) => l.temperatura === "quente" && l.status === "aberto").length,
      potencial: leads.reduce((s, l) => s + Number(l.potencial_mensal ?? 0), 0),
    };
  }, [leads]);

  async function mover(lead: LeadRow, nova: string) {
    try {
      await fnMover({ data: { id: lead.id, etapa: nova } });
      void qc.invalidateQueries({ queryKey: ["pxsales", "leads"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível mover o lead");
    }
  }

  async function converter(lead: LeadRow) {
    try {
      const r = await fnConverter({ data: { id: lead.id } });
      toast.success("Lead convertido em oportunidade");
      void qc.invalidateQueries({ queryKey: ["pxsales"] });
      void navigate({ to: "/sales/oportunidades" });
      return r;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível converter o lead");
    }
  }

  async function remover(lead: LeadRow) {
    if (!confirm(`Excluir o lead "${lead.empresa}"?`)) return;
    try {
      await fnExcluir({ data: { id: lead.id } });
      toast.success("Lead excluído");
      void qc.invalidateQueries({ queryKey: ["pxsales", "leads"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir o lead");
    }
  }

  return (
    <PxSalesShell
      title="Leads"
      subtitle="Captação e qualificação"
      headerActions={
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1.5" /> Novo lead
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Leads listados", value: String(kpis.total) },
          { label: "Em aberto", value: String(kpis.abertos) },
          { label: "Quentes", value: String(kpis.quentes) },
          { label: "Potencial mensal", value: brl(kpis.potencial) },
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
            placeholder="Buscar por empresa, contato, cidade ou CNPJ"
            className="pl-8"
          />
        </div>
        <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Todas etapas</option>
          {etapas.map((e) => <option key={e.chave} value={e.chave}>{e.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="aberto">Em aberto</option>
          <option value="convertido">Convertidos</option>
          <option value="perdido">Perdidos</option>
          <option value="">Todos</option>
        </select>
        <button
          onClick={() => setMeus((v) => !v)}
          className={`h-9 px-3 rounded-md text-sm ring-1 transition ${meus ? "ring-transparent bg-brand/15 text-foreground" : "ring-border text-muted-foreground hover:text-foreground"}`}
        >
          Meus leads
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando leads…
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <Sparkles className="size-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">Nenhum lead encontrado com esses filtros.</div>
          <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Cadastrar o primeiro lead
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((l) => (
            <div key={l.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.empresa}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {l.cnpj ? formatCnpj(l.cnpj) : "sem CNPJ"} · {[l.cidade, l.uf].filter(Boolean).join("/") || "—"}
                  </div>
                </div>
                <Flame className={`size-4 shrink-0 ${TEMP_COR[l.temperatura] ?? "text-muted-foreground"}`} />
              </div>

              <div className="text-xs text-muted-foreground">
                {l.contato_nome ? `${l.contato_nome}${l.contato_cargo ? ` · ${l.contato_cargo}` : ""}` : "Sem contato informado"}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>Potencial: <strong>{brl(l.potencial_mensal)}</strong></span>
                <span>Origem: {l.origem}</span>
                <span>Resp.: {l.responsavel_nome ?? "—"}</span>
              </div>

              {l.proxima_acao && (
                <div className="text-xs rounded-md bg-background/60 ring-1 ring-border px-2 py-1.5">
                  <span className="text-muted-foreground">Próxima ação:</span> {l.proxima_acao} · {dataHora(l.proxima_acao_em)}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <select
                  value={l.etapa}
                  onChange={(e) => mover(l, e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  {etapas.map((e) => <option key={e.chave} value={e.chave}>{e.label}</option>)}
                </select>
                {l.contato_telefone && (
                  <a href={`tel:${l.contato_telefone}`} className="h-8 w-8 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface" aria-label="Ligar">
                    <Phone className="size-3.5" />
                  </a>
                )}
                {l.contato_email && (
                  <a href={`mailto:${l.contato_email}`} className="h-8 w-8 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface" aria-label="E-mail">
                    <Mail className="size-3.5" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" className="flex-1" disabled={l.status === "convertido"} onClick={() => converter(l)}>
                  <ArrowRightLeft className="size-3.5 mr-1.5" />
                  {l.status === "convertido" ? "Convertido" : "Converter"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpen(true); }} aria-label="Editar">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remover(l)} aria-label="Excluir">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LeadDialog open={open} onOpenChange={setOpen} lead={editing} />
    </PxSalesShell>
  );
}
