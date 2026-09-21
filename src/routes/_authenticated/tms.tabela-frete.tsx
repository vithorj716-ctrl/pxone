import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Upload, Calculator, Loader2, Table2 } from "lucide-react";
import { TmsShell } from "@/components/tms/tms-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { RegraDialog } from "@/components/tms/regra-dialog";
import { ImportarTabelaDialog } from "@/components/tms/importar-tabela-dialog";
import {
  listTabelasFrete, saveTabelaFrete, deleteTabelaFrete, deleteRegraTabela,
} from "@/lib/tms-tabelas.functions";
import { calcularTabelaFrete, regrasLegado, MODOS, BASES } from "@/pxlog/regra-engine";
import { parseDecimal } from "@/pxlog/num";

export const Route = createFileRoute("/_authenticated/tms/tabela-frete")({
  head: () => ({
    meta: [
      { title: "PXLog — Tabela comercial de fretes | Grupo PX" },
      { name: "description", content: "Monte tabelas comerciais com regras estruturadas: frete, GRIS, ad valorem, pedágio, taxas e serviços." },
      { property: "og:title", content: "PXLog — Tabela comercial de fretes" },
      { property: "og:description", content: "Regras comerciais configuráveis, simulação e importação de tabelas de preços." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TabelaFretePage,
});

const campo = "h-10 w-full rounded-md bg-background ring-1 ring-border px-3 text-sm";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const rotuloModo = (m: string) => MODOS.find((x) => x.value === m)?.label ?? m;
const rotuloBase = (b: string) => BASES.find((x) => x.value === b)?.label ?? b;

function TabelaFretePage() {
  const fnList = useServerFn(listTabelasFrete);
  const fnSaveTabela = useServerFn(saveTabelaFrete);
  const fnDelTabela = useServerFn(deleteTabelaFrete);
  const fnDelRegra = useServerFn(deleteRegraTabela);

  const [dados, setDados] = useState<{ tabelas: any[]; servicos: any[]; rotas: any[] }>({ tabelas: [], servicos: [], rotas: [] });
  const [carregando, setCarregando] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [tabelaDialog, setTabelaDialog] = useState<any | null>(null);
  const [regraDialog, setRegraDialog] = useState<{ open: boolean; regra: any | null }>({ open: false, regra: null });
  const [importOpen, setImportOpen] = useState(false);

  const [sim, setSim] = useState({ peso: "100", cubagem: "1", valor_nota: "10000", volumes: "2", distancia_km: "0" });

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fnList({ data: {} });
      setDados(r as any);
      setSelId((atual) => atual ?? (r as any).tabelas[0]?.id ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar tabelas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    supabase.from("tms_clientes").select("id, nome").order("nome").then(({ data }) =>
      setClientes(((data ?? []) as any[]).map((c) => ({ id: c.id, nome: c.nome }))),
    );
  }, []);

  const tabela = useMemo(() => dados.tabelas.find((t) => t.id === selId) ?? null, [dados, selId]);
  const regras = useMemo(() => (tabela?.regras?.length ? tabela.regras : tabela ? regrasLegado(tabela) : []), [tabela]);

  const resultado = useMemo(() => {
    const peso = parseDecimal(sim.peso) ?? 0;
    const cubagem = parseDecimal(sim.cubagem) ?? 0;
    const pesoCubado = cubagem * 300;
    return calcularTabelaFrete(regras, {
      peso,
      peso_taxado: Math.max(peso, pesoCubado),
      cubagem,
      volumes: parseDecimal(sim.volumes) ?? 0,
      valor_nota: parseDecimal(sim.valor_nota) ?? 0,
      distancia_km: parseDecimal(sim.distancia_km) ?? 0,
      rota_id: null,
    });
  }, [regras, sim]);

  async function excluirTabela(id: string) {
    if (!confirm("Excluir esta tabela e todas as suas regras?")) return;
    await fnDelTabela({ data: { id } });
    setSelId(null);
    carregar();
  }

  async function excluirRegra(id: string) {
    await fnDelRegra({ data: { id } });
    toast.success("Regra removida.");
    carregar();
  }

  return (
    <TmsShell
      title="Tabela comercial de fretes"
      subtitle="Cada tabela é um conjunto de regras: frete, adicionais, taxas e serviços"
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" onClick={() => setTabelaDialog({})}>
          <Plus className="size-4 mr-1" /> Nova tabela
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
          <Upload className="size-4 mr-1" /> Importar tabela
        </Button>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando tabelas…
        </div>
      ) : !dados.tabelas.length ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-10 text-center">
          <Table2 className="size-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm">Nenhuma tabela comercial cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {dados.tabelas.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelId(t.id)}
                className={`w-full text-left rounded-lg ring-1 p-3 transition ${t.id === selId ? "ring-primary bg-primary/5" : "ring-border bg-surface/30"}`}
              >
                <div className="text-sm font-medium break-words">{t.nome}</div>
                <div className="text-[11px] text-muted-foreground">
                  {[t.origem, t.destino].filter(Boolean).join(" → ") || "Todas as rotas"} · {(t.regras?.length ?? 0) || regrasLegado(t).length} regra(s)
                </div>
              </button>
            ))}
          </div>

          {tabela && (
            <div className="space-y-4">
              <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-medium">{tabela.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {clientes.find((c) => c.id === tabela.cliente_id)?.nome ?? "Todos os clientes"} ·{" "}
                      {[tabela.origem, tabela.destino].filter(Boolean).join(" → ") || "Qualquer trecho"} · prazo {tabela.prazo_dias} dia(s)
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setTabelaDialog(tabela)}><Pencil className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => excluirTabela(tabela.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">Regras comerciais</div>
                  <Button size="sm" onClick={() => setRegraDialog({ open: true, regra: null })}>
                    <Plus className="size-4 mr-1" /> Adicionar regra
                  </Button>
                </div>

                {!tabela.regras?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Esta tabela ainda usa apenas os campos antigos. Eles continuam calculando normalmente — adicione regras para detalhar a cobrança.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...tabela.regras].sort((a: any, b: any) => a.ordem - b.ordem).map((r: any) => (
                      <div key={r.id} className="rounded-lg ring-1 ring-border p-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm">{r.nome} {r.ativo === false && <span className="text-[10px] text-muted-foreground">(inativa)</span>}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {rotuloModo(r.modo)}
                            {r.valor !== null && ` · ${r.modo === "percentual" ? `${r.valor}%` : brl(Number(r.valor))}`}
                            {r.base_calculo !== "nenhuma" && ` · base: ${rotuloBase(r.base_calculo)}`}
                            {(r.faixa_min !== null || r.faixa_max !== null) && ` · faixa ${r.faixa_min ?? "—"}–${r.faixa_max ?? "—"}`}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setRegraDialog({ open: true, regra: r })}><Pencil className="size-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => excluirRegra(r.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                  <Calculator className="size-4" /> Simulação
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                  {[
                    { k: "peso", l: "Peso (kg)" },
                    { k: "cubagem", l: "Cubagem (m³)" },
                    { k: "valor_nota", l: "Valor da nota" },
                    { k: "volumes", l: "Volumes" },
                    { k: "distancia_km", l: "Distância (km)" },
                  ].map((c) => (
                    <div key={c.k}>
                      <Label className="text-[11px]">{c.l}</Label>
                      <Input
                        className="h-9"
                        inputMode="decimal"
                        value={(sim as any)[c.k]}
                        onChange={(e) => setSim((p) => ({ ...p, [c.k]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-sm space-y-1">
                  {resultado.linhas.map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{l.nome}</span>
                      <span>{brl(l.valor)}</span>
                    </div>
                  ))}
                  {resultado.minimo_aplicado !== null && (
                    <div className="flex justify-between text-amber-500">
                      <span>Frete mínimo aplicado</span><span>{brl(resultado.minimo_aplicado)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t border-border pt-1">
                    <span>Total</span><span>{brl(resultado.total)}</span>
                  </div>
                  {resultado.avisos.map((a, i) => (
                    <div key={i} className="text-[11px] text-amber-500">{a}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tabelaDialog && (
        <TabelaDialog
          tabela={tabelaDialog}
          clientes={clientes}
          onClose={() => setTabelaDialog(null)}
          onSalvar={async (dados2) => {
            const r = await fnSaveTabela({ data: { ...dados2, id: tabelaDialog.id } });
            setTabelaDialog(null);
            setSelId(r.id);
            carregar();
          }}
        />
      )}

      {tabela && (
        <RegraDialog
          open={regraDialog.open}
          onOpenChange={(v) => setRegraDialog({ open: v, regra: v ? regraDialog.regra : null })}
          tabelaId={tabela.id}
          regra={regraDialog.regra}
          servicos={dados.servicos}
          rotas={dados.rotas}
          onSaved={carregar}
          onEntidades={carregar}
        />
      )}

      <ImportarTabelaDialog open={importOpen} onOpenChange={setImportOpen} onImportado={carregar} />
    </TmsShell>
  );
}

function TabelaDialog({
  tabela, clientes, onClose, onSalvar,
}: {
  tabela: any;
  clientes: { id: string; nome: string }[];
  onClose: () => void;
  onSalvar: (dados: Record<string, any>) => Promise<void>;
}) {
  const [f, setF] = useState<Record<string, any>>({
    nome: tabela.nome ?? "",
    cliente_id: tabela.cliente_id ?? "",
    origem: tabela.origem ?? "",
    destino: tabela.destino ?? "",
    prazo_dias: tabela.prazo_dias ?? 1,
    ativo: tabela.ativo !== false,
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tabela.id ? "Editar tabela" : "Nova tabela comercial"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={f["nome"]} onChange={(e) => set("nome", e.target.value)} placeholder="Cliente X — SP → GO" />
          </div>
          <div>
            <Label>Cliente</Label>
            <select className={campo} value={f["cliente_id"]} onChange={(e) => set("cliente_id", e.target.value)}>
              <option value="">Todos os clientes</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Origem</Label><Input value={f["origem"]} onChange={(e) => set("origem", e.target.value)} /></div>
            <div><Label>Destino</Label><Input value={f["destino"]} onChange={(e) => set("destino", e.target.value)} /></div>
          </div>
          <div>
            <Label>Prazo (dias)</Label>
            <Input value={f["prazo_dias"]} inputMode="numeric" onChange={(e) => set("prazo_dias", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={salvando}
            onClick={async () => {
              setSalvando(true);
              try { await onSalvar(f); } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); } finally { setSalvando(false); }
            }}
          >
            {salvando && <Loader2 className="size-4 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
