import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, CalendarClock, Check, Trash2, Pencil } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listAtividades,
  saveAtividade,
  concluirAtividade,
  excluirAtividade,
  listLeads,
  listOportunidades,
  listResponsaveis,
  TIPOS_ATIVIDADE,
  type AtividadeRow,
} from "@/lib/pxsales-pipeline.functions";

export const Route = createFileRoute("/_authenticated/sales/followups")({
  head: () => ({
    meta: [
      { title: "PXSales — Follow-ups | Grupo PX" },
      { name: "description", content: "Follow-ups comerciais do dia, atrasados e programados." },
      { property: "og:title", content: "PXSales — Follow-ups" },
      { property: "og:description", content: "Follow-ups comerciais do dia e atrasados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesFollowupsPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

const FILTROS = [
  { v: "hoje", l: "Hoje" },
  { v: "atrasados", l: "Atrasados" },
  { v: "programados", l: "Programados" },
  { v: "concluidos", l: "Concluídos" },
  { v: "todos", l: "Todos" },
] as const;

const dataHora = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem data";

const vazio = {
  tipo: "ligacao",
  assunto: "",
  descricao: "",
  lead_id: "",
  oportunidade_id: "",
  responsavel_id: "",
  prevista_para: "",
};

function SalesFollowupsPage() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["v"]>("hoje");
  const [meus, setMeus] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(vazio);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const qc = useQueryClient();
  const fn = useServerFn(listAtividades);
  const fnSave = useServerFn(saveAtividade);
  const fnConcluir = useServerFn(concluirAtividade);
  const fnExcluir = useServerFn(excluirAtividade);
  const fnLeads = useServerFn(listLeads);
  const fnOps = useServerFn(listOportunidades);
  const fnResp = useServerFn(listResponsaveis);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pxsales", "atividades", filtro, meus],
    queryFn: () => fn({ data: { filtro, meus } }),
  });
  const { data: leads = [] } = useQuery({ queryKey: ["pxsales", "leads", "", "", "aberto", false], queryFn: () => fnLeads({ data: { status: "aberto" } }), staleTime: 120_000 });
  const { data: ops = [] } = useQuery({ queryKey: ["pxsales", "oportunidades", "", "", false], queryFn: () => fnOps({ data: {} }), staleTime: 120_000 });
  const { data: responsaveis = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnResp(), staleTime: 300_000 });

  const kpis = useMemo(() => {
    const pendentes = rows.filter((r) => !r.concluida);
    return { total: rows.length, pendentes: pendentes.length, concluidas: rows.length - pendentes.length };
  }, [rows]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const campo = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  function abrirNovo() {
    setEditId(null);
    setForm(vazio);
    setOpen(true);
  }

  function abrirEdicao(a: AtividadeRow) {
    setEditId(a.id);
    setForm({
      tipo: a.tipo,
      assunto: a.assunto,
      descricao: a.descricao ?? "",
      lead_id: a.lead_id ?? "",
      oportunidade_id: a.oportunidade_id ?? "",
      responsavel_id: a.responsavel_id ?? "",
      prevista_para: a.prevista_para ? a.prevista_para.slice(0, 16) : "",
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.assunto?.trim()) {
      toast.error("Informe o assunto.");
      return;
    }
    setSaving(true);
    try {
      await fnSave({
        data: {
          id: editId ?? undefined,
          tipo: form.tipo,
          assunto: form.assunto,
          descricao: form.descricao || null,
          lead_id: form.lead_id || null,
          oportunidade_id: form.oportunidade_id || null,
          responsavel_id: form.responsavel_id || null,
          prevista_para: form.prevista_para ? new Date(form.prevista_para).toISOString() : null,
        },
      });
      toast.success(editId ? "Follow-up atualizado" : "Follow-up agendado");
      void qc.invalidateQueries({ queryKey: ["pxsales", "atividades"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function alternarConclusao(a: AtividadeRow) {
    try {
      await fnConcluir({ data: { id: a.id, concluida: !a.concluida } });
      void qc.invalidateQueries({ queryKey: ["pxsales", "atividades"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar");
    }
  }

  async function remover(a: AtividadeRow) {
    if (!confirm(`Excluir "${a.assunto}"?`)) return;
    try {
      await fnExcluir({ data: { id: a.id } });
      void qc.invalidateQueries({ queryKey: ["pxsales", "atividades"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir");
    }
  }

  return (
    <PxSalesShell
      title="Follow-ups"
      subtitle="Retornos e cobranças"
      headerActions={
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="size-4 mr-1.5" /> Novo follow-up
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Listados", value: String(kpis.total) },
          { label: "Pendentes", value: String(kpis.pendentes) },
          { label: "Concluídos", value: String(kpis.concluidas) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl ring-1 ring-border bg-surface/30 p-3.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
            <div className="text-lg font-semibold mt-1">{isLoading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTROS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className={`h-9 px-3 rounded-md text-sm ring-1 transition ${filtro === f.v ? "ring-transparent bg-brand/15 text-foreground" : "ring-border text-muted-foreground hover:text-foreground"}`}
          >
            {f.l}
          </button>
        ))}
        <button
          onClick={() => setMeus((v) => !v)}
          className={`h-9 px-3 rounded-md text-sm ring-1 transition ml-auto ${meus ? "ring-transparent bg-brand/15 text-foreground" : "ring-border text-muted-foreground hover:text-foreground"}`}
        >
          Somente meus
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando follow-ups…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <CalendarClock className="size-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">Nada por aqui neste filtro.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((a) => {
            const atrasado = !a.concluida && a.prevista_para && new Date(a.prevista_para) < new Date();
            return (
              <div key={a.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-3 flex items-start gap-3">
                <button
                  onClick={() => alternarConclusao(a)}
                  className={`mt-0.5 size-5 shrink-0 rounded-md grid place-items-center ring-1 ${a.concluida ? "bg-emerald-500/20 ring-emerald-500 text-emerald-400" : "ring-border text-transparent hover:text-muted-foreground"}`}
                  aria-label={a.concluida ? "Reabrir" : "Concluir"}
                >
                  <Check className="size-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${a.concluida ? "line-through text-muted-foreground" : ""}`}>{a.assunto}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.tipo} · {dataHora(a.prevista_para)}
                    {a.referencia ? ` · ${a.referencia}` : ""}
                    {a.responsavel_nome ? ` · ${a.responsavel_nome}` : ""}
                  </div>
                  {a.descricao && <div className="text-xs mt-1 text-muted-foreground">{a.descricao}</div>}
                </div>
                {atrasado && <span className="text-[10px] uppercase tracking-widest text-red-400 shrink-0">Atrasado</span>}
                <button onClick={() => abrirEdicao(a)} className="h-7 w-7 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface shrink-0" aria-label="Editar">
                  <Pencil className="size-3" />
                </button>
                <button onClick={() => remover(a)} className="h-7 w-7 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface shrink-0" aria-label="Excluir">
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar follow-up" : "Novo follow-up"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <select className={campo} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                  {TIPOS_ATIVIDADE.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={form.prevista_para} onChange={(e) => set("prevista_para", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Assunto *</Label>
              <Input value={form.assunto} onChange={(e) => set("assunto", e.target.value)} placeholder="Ex.: retornar sobre a proposta" />
            </div>
            <div>
              <Label>Lead</Label>
              <select className={campo} value={form.lead_id} onChange={(e) => set("lead_id", e.target.value)}>
                <option value="">Nenhum</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.empresa}</option>)}
              </select>
            </div>
            <div>
              <Label>Oportunidade</Label>
              <select className={campo} value={form.oportunidade_id} onChange={(e) => set("oportunidade_id", e.target.value)}>
                <option value="">Nenhuma</option>
                {ops.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </div>
            <div>
              <Label>Responsável</Label>
              <select className={campo} value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)}>
                <option value="">Eu mesmo</option>
                {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PxSalesShell>
  );
}
