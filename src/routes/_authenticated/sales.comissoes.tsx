import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, Percent } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listComissaoRegras,
  saveComissaoRegra,
  excluirComissaoRegra,
  listComissoes,
  apurarComissoes,
  setStatusComissao,
  STATUS_COMISSAO,
  type ComissaoRegra,
} from "@/lib/pxsales-comissoes.functions";
import { listResponsaveis } from "@/lib/pxsales-pipeline.functions";

export const Route = createFileRoute("/_authenticated/sales/comissoes")({
  head: () => ({
    meta: [
      { title: "PXSales — Comissões | Grupo PX" },
      { name: "description", content: "Regras de comissão por vigência e comissões apuradas com histórico congelado." },
      { property: "og:title", content: "PXSales — Comissões" },
      { property: "og:description", content: "Regras e apuração de comissões do time comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComissoesPage,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

function ComissoesPage() {
  const qc = useQueryClient();
  const fnRegras = useServerFn(listComissaoRegras);
  const fnComissoes = useServerFn(listComissoes);
  const fnApurar = useServerFn(apurarComissoes);
  const fnStatus = useServerFn(setStatusComissao);
  const fnExcluir = useServerFn(excluirComissaoRegra);
  const fnResp = useServerFn(listResponsaveis);

  const [aba, setAba] = useState<"apuradas" | "regras">("apuradas");
  const [status, setStatus] = useState("");
  const [editar, setEditar] = useState<ComissaoRegra | null>(null);
  const [aberto, setAberto] = useState(false);

  const { data: regras = [] } = useQuery({ queryKey: ["pxsales", "comissao-regras"], queryFn: () => fnRegras() });
  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["pxsales", "comissoes", status],
    queryFn: () => fnComissoes({ data: { status: status || undefined } }),
  });
  const { data: responsaveis = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnResp() });

  const nomeResp = (id: string | null) =>
    (responsaveis as any[]).find((r) => r.id === id)?.nome ?? "Sem responsável";

  const total = comissoes.reduce((s, c) => s + Number(c.valor ?? 0), 0);
  const previstas = comissoes.filter((c) => c.status === "prevista").reduce((s, c) => s + Number(c.valor ?? 0), 0);

  async function apurar() {
    try {
      const r = await fnApurar({ data: {} });
      toast.success(`${r.criadas} comissão(ões) apurada(s). ${r.ignoradas} já existiam ou sem regra vigente.`);
      qc.invalidateQueries({ queryKey: ["pxsales", "comissoes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível apurar.");
    }
  }

  async function mudarStatus(id: string, novo: string) {
    try {
      await fnStatus({ data: { id, status: novo } });
      qc.invalidateQueries({ queryKey: ["pxsales", "comissoes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar.");
    }
  }

  async function removerRegra(id: string) {
    try {
      await fnExcluir({ data: { id } });
      toast.success("Regra removida. As comissões já apuradas continuam com o valor congelado.");
      qc.invalidateQueries({ queryKey: ["pxsales", "comissao-regras"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover.");
    }
  }

  return (
    <PxSalesShell title="Comissões" subtitle="Regras e apuração">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi label="Comissões" valor={String(comissoes.length)} />
          <Kpi label="Previstas" valor={brl(previstas)} />
          <Kpi label="Total apurado" valor={brl(total)} />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-md border p-0.5">
            <button
              className={`px-3 py-1.5 text-sm rounded ${aba === "apuradas" ? "bg-accent" : ""}`}
              onClick={() => setAba("apuradas")}
            >
              Apuradas
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded ${aba === "regras" ? "bg-accent" : ""}`}
              onClick={() => setAba("regras")}
            >
              Regras
            </button>
          </div>
          {aba === "apuradas" ? (
            <>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todas as situações</option>
                {STATUS_COMISSAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Button variant="outline" onClick={apurar}><RefreshCw className="size-4 mr-1.5" /> Apurar propostas aceitas</Button>
            </>
          ) : (
            <Button onClick={() => { setEditar(null); setAberto(true); }}><Plus className="size-4 mr-1.5" /> Nova regra</Button>
          )}
        </div>

        {aba === "apuradas" ? (
          isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : comissoes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              <Percent className="size-6 mx-auto mb-2 opacity-60" />
              Nenhuma comissão apurada. Cadastre uma regra vigente e clique em “Apurar propostas aceitas”.
            </div>
          ) : (
            <div className="grid gap-2">
              {comissoes.map((c) => (
                <div key={c.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.empresa_nome}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {nomeResp(c.responsavel_id)} · competência {dia(c.competencia)} · base {brl(Number(c.base_valor))}
                      {Number(c.percentual) ? ` · ${c.percentual}%` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{brl(Number(c.valor))}</span>
                    <select
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={c.status}
                      onChange={(e) => mudarStatus(c.id, e.target.value)}
                    >
                      {STATUS_COMISSAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : regras.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada. Crie uma regra geral e, se quiser, regras específicas por vendedor.
          </div>
        ) : (
          <div className="grid gap-2">
            {regras.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {r.nome} {!r.ativo && <span className="text-xs text-muted-foreground">(inativa)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {r.tipo === "fixo" ? brl(Number(r.valor_fixo)) : `${r.percentual}% sobre a proposta`} ·{" "}
                    {r.responsavel_id ? nomeResp(r.responsavel_id) : "Todos os vendedores"} · vigência {dia(r.vigencia_inicio)} até{" "}
                    {r.vigencia_fim ? dia(r.vigencia_fim) : "sem fim"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditar(r); setAberto(true); }}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => removerRegra(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RegraDialog
        open={aberto}
        onOpenChange={setAberto}
        regra={editar}
        responsaveis={responsaveis as any[]}
        onSaved={() => qc.invalidateQueries({ queryKey: ["pxsales", "comissao-regras"] })}
      />
    </PxSalesShell>
  );
}

function RegraDialog({
  open,
  onOpenChange,
  regra,
  responsaveis,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  regra: ComissaoRegra | null;
  responsaveis: any[];
  onSaved: () => void;
}) {
  const salvar = useServerFn(saveComissaoRegra);
  const [form, setForm] = useState<any>({});
  const [salvando, setSalvando] = useState(false);

  const v = (campo: string, def: any = "") => form[campo] ?? (regra ? (regra as any)[campo] ?? def : def);
  const set = (campo: string, valor: any) => setForm((f: any) => ({ ...f, [campo]: valor }));

  async function submit() {
    setSalvando(true);
    try {
      await salvar({
        data: {
          id: regra?.id,
          nome: v("nome"),
          tipo: v("tipo", "percentual"),
          percentual: v("percentual", 0),
          valor_fixo: v("valor_fixo", 0),
          responsavel_id: v("responsavel_id", "") || null,
          vigencia_inicio: v("vigencia_inicio", new Date().toISOString().slice(0, 10)),
          vigencia_fim: v("vigencia_fim", "") || null,
          ativo: v("ativo", true),
        },
      });
      toast.success("Regra salva.");
      setForm({});
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setForm({}); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{regra ? "Editar regra" : "Nova regra de comissão"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={v("nome")} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Comissão padrão 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={v("tipo", "percentual")}
                onChange={(e) => set("tipo", e.target.value)}
              >
                <option value="percentual">Percentual da proposta</option>
                <option value="fixo">Valor fixo por proposta</option>
              </select>
            </div>
            <div>
              <Label>{v("tipo", "percentual") === "fixo" ? "Valor (R$)" : "Percentual (%)"}</Label>
              <Input
                inputMode="decimal"
                value={v("tipo", "percentual") === "fixo" ? v("valor_fixo", 0) : v("percentual", 0)}
                onChange={(e) => set(v("tipo", "percentual") === "fixo" ? "valor_fixo" : "percentual", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Vendedor</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={v("responsavel_id", "")}
              onChange={(e) => set("responsavel_id", e.target.value)}
            >
              <option value="">Todos (regra geral)</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início da vigência</Label>
              <Input type="date" value={String(v("vigencia_inicio", new Date().toISOString().slice(0, 10))).slice(0, 10)} onChange={(e) => set("vigencia_inicio", e.target.value)} />
            </div>
            <div>
              <Label>Fim da vigência</Label>
              <Input type="date" value={String(v("vigencia_fim", "") ?? "").slice(0, 10)} onChange={(e) => set("vigencia_fim", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!v("ativo", true)} onChange={(e) => set("ativo", e.target.checked)} />
            Regra ativa
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={salvando}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
