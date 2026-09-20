import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Loader2, Target, Pencil, Trash2, CalendarDays } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { OportunidadeDialog } from "@/components/pxsales/oportunidade-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listOportunidades,
  listPipelineEtapas,
  listResponsaveis,
  moverOportunidade,
  excluirOportunidade,
  type OportunidadeRow,
} from "@/lib/pxsales-pipeline.functions";

export const Route = createFileRoute("/_authenticated/sales/oportunidades")({
  head: () => ({
    meta: [
      { title: "PXSales — Oportunidades | Grupo PX" },
      { name: "description", content: "Pipeline de oportunidades comerciais em kanban, por etapa e responsável." },
      { property: "og:title", content: "PXSales — Oportunidades" },
      { property: "og:description", content: "Pipeline de oportunidades comerciais em kanban." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesOportunidadesPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBR = (v: string | null) => (v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function SalesOportunidadesPage() {
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [incluirFechadas, setIncluirFechadas] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OportunidadeRow | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const qc = useQueryClient();
  const fn = useServerFn(listOportunidades);
  const fnEtapas = useServerFn(listPipelineEtapas);
  const fnResp = useServerFn(listResponsaveis);
  const fnMover = useServerFn(moverOportunidade);
  const fnExcluir = useServerFn(excluirOportunidade);

  const { data: etapas = [] } = useQuery({ queryKey: ["pxsales", "etapas"], queryFn: () => fnEtapas(), staleTime: 300_000 });
  const { data: responsaveis = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnResp(), staleTime: 300_000 });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pxsales", "oportunidades", busca, responsavel, incluirFechadas],
    queryFn: () => fn({ data: { search: busca || undefined, responsavel_id: responsavel || undefined, incluirFechadas } }),
  });

  const porEtapa = useMemo(() => {
    const m = new Map<string, OportunidadeRow[]>();
    for (const e of etapas) m.set(e.chave, []);
    for (const r of rows) {
      if (!m.has(r.etapa)) m.set(r.etapa, []);
      m.get(r.etapa)!.push(r);
    }
    return m;
  }, [rows, etapas]);

  const kpis = useMemo(() => {
    const abertas = rows.filter((r) => r.status === "aberta");
    const ponderado = abertas.reduce((s, r) => s + r.valor_estimado * (r.probabilidade / 100), 0);
    return {
      abertas: abertas.length,
      valor: abertas.reduce((s, r) => s + r.valor_estimado, 0),
      ponderado,
      ganhas: rows.filter((r) => r.status === "ganha").length,
    };
  }, [rows]);

  async function mover(id: string, etapa: string) {
    try {
      let motivo: string | undefined;
      if (etapa === "perdido") motivo = prompt("Motivo da perda (opcional):") ?? undefined;
      await fnMover({ data: { id, etapa, motivo_perda: motivo } });
      void qc.invalidateQueries({ queryKey: ["pxsales", "oportunidades"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível mover a oportunidade");
    }
  }

  async function remover(op: OportunidadeRow) {
    if (!confirm(`Excluir a oportunidade "${op.titulo}"?`)) return;
    try {
      await fnExcluir({ data: { id: op.id } });
      toast.success("Oportunidade excluída");
      void qc.invalidateQueries({ queryKey: ["pxsales", "oportunidades"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir");
    }
  }

  return (
    <PxSalesShell
      title="Oportunidades"
      subtitle="Pipeline comercial"
      headerActions={
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1.5" /> Nova oportunidade
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Oportunidades abertas", value: String(kpis.abertas) },
          { label: "Valor em pipeline", value: brl(kpis.valor) },
          { label: "Valor ponderado", value: brl(kpis.ponderado) },
          { label: "Ganhas no filtro", value: String(kpis.ganhas) },
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
            placeholder="Buscar por título ou empresa"
            className="pl-8"
          />
        </div>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <button
          onClick={() => setIncluirFechadas((v) => !v)}
          className={`h-9 px-3 rounded-md text-sm ring-1 transition ${incluirFechadas ? "ring-transparent bg-brand/15 text-foreground" : "ring-border text-muted-foreground hover:text-foreground"}`}
        >
          Incluir fechadas
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando pipeline…
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {etapas.map((etapa) => {
            const lista = porEtapa.get(etapa.chave) ?? [];
            const total = lista.reduce((s, r) => s + r.valor_estimado, 0);
            return (
              <div
                key={etapa.chave}
                onDragOver={(e) => { e.preventDefault(); setSobre(etapa.chave); }}
                onDragLeave={() => setSobre((s) => (s === etapa.chave ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  if (dragId) void mover(dragId, etapa.chave);
                  setDragId(null);
                }}
                className={`w-[270px] shrink-0 rounded-xl ring-1 p-2.5 transition ${sobre === etapa.chave ? "ring-brand bg-brand/5" : "ring-border bg-surface/20"}`}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: etapa.cor }} />
                    <span className="text-xs font-medium truncate">{etapa.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{lista.length}</span>
                </div>
                <div className="text-[10px] text-muted-foreground px-1 mb-2">{brl(total)}</div>

                <div className="flex flex-col gap-2 min-h-[80px]">
                  {lista.map((op) => (
                    <div
                      key={op.id}
                      draggable
                      onDragStart={() => setDragId(op.id)}
                      onDragEnd={() => setDragId(null)}
                      className="rounded-lg bg-background/70 ring-1 ring-border p-2.5 cursor-grab active:cursor-grabbing"
                    >
                      <div className="text-xs font-medium leading-snug">{op.titulo}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{op.cliente_nome ?? op.empresa_nome ?? "Sem empresa"}</div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px]">
                        <span className="font-semibold">{brl(op.valor_estimado)}</span>
                        <span className="text-muted-foreground">{op.probabilidade}%</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <CalendarDays className="size-3" /> {dataBR(op.previsao_fechamento)}
                        <span className="truncate ml-auto">{op.responsavel_nome ?? "—"}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <select
                          value={op.etapa}
                          onChange={(e) => mover(op.id, e.target.value)}
                          className="h-7 flex-1 rounded-md border border-input bg-transparent px-1.5 text-[11px]"
                          aria-label="Mover etapa"
                        >
                          {etapas.map((e) => <option key={e.chave} value={e.chave}>{e.label}</option>)}
                        </select>
                        <button onClick={() => { setEditing(op); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface" aria-label="Editar">
                          <Pencil className="size-3" />
                        </button>
                        <button onClick={() => remover(op)} className="h-7 w-7 grid place-items-center rounded-md ring-1 ring-border hover:bg-surface" aria-label="Excluir">
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {lista.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
                      Arraste uma oportunidade para cá
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center mt-2">
          <Target className="size-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">Nenhuma oportunidade ainda. Crie uma ou converta um lead.</div>
        </div>
      )}

      <OportunidadeDialog open={open} onOpenChange={setOpen} oportunidade={editing} />
    </PxSalesShell>
  );
}
