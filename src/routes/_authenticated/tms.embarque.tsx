import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TmsShell } from "@/components/tms/tms-shell";
import { ScanInput } from "@/components/tms/scan-input";
import { supabase } from "@/integrations/supabase/client";
import { iniciarEmbarque, bipVolumeEmbarque, finalizarEmbarque, getPainelViagem } from "@/lib/tms-viagens.functions";
import { playBeep } from "@/lib/beep";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Truck, Clock, Package, AlertTriangle, Play, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/tms/embarque")({
  head: () => ({ meta: [{ title: "PXLog — Embarque" }] }),
  component: EmbarquePage,
});

type ViagemAtiva = { id: string; codigo: string };

function EmbarquePage() {
  const [viagem, setViagem] = useState<ViagemAtiva | null>(null);
  return (
    <TmsShell title="Embarque" subtitle={viagem ? `Viagem ${viagem.codigo}` : "Selecione viagem para iniciar"}>
      {viagem
        ? <EmbarqueOperacao viagemId={viagem.id} onSair={() => setViagem(null)} />
        : <EmbarqueSetup onIniciada={(v) => setViagem(v)} />
      }
    </TmsShell>
  );
}

// -----------------------------------------------------------------------------
// Setup da viagem
// -----------------------------------------------------------------------------
function EmbarqueSetup({ onIniciada }: { onIniciada: (v: ViagemAtiva) => void }) {
  const iniciar = useServerFn(iniciarEmbarque);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [minutas, setMinutas] = useState<any[]>([]);
  const [viagensPlanejadas, setViagensPlanejadas] = useState<any[]>([]);

  const [viagemSel, setViagemSel] = useState<string>("");
  const [origem, setOrigem] = useState("Goiânia");
  const [destino, setDestino] = useState("Brasília");
  const [rota, setRota] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [dataPrev, setDataPrev] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: ms }, { data: vs }, { data: mins }, { data: planej }] = await Promise.all([
        supabase.from("tms_lm_motoristas").select("id, nome, telefone").eq("ativo", true).order("nome"),
        supabase.from("tms_lm_veiculos").select("id, placa, modelo, capacidade_kg").eq("ativo", true).order("placa"),
        supabase.from("tms_minutas").select("id, numero, origem, destino, qtd_volumes, peso_taxado, cubagem, status, cancelada_em, tms_clientes(nome)").is("cancelada_em", null).in("status", ["solicitado","recebido_hub_origem","conferido","etiquetado","coletado"]).order("numero", { ascending: false }).limit(200),
        supabase.from("tms_viagens").select("id, codigo, origem, destino, rota, motorista_id, veiculo_id, placa, data_prevista").eq("status", "planejada").order("created_at", { ascending: false }),
      ]);
      setMotoristas(ms ?? []);
      setVeiculos(vs ?? []);
      setMinutas(mins ?? []);
      setViagensPlanejadas(planej ?? []);
    })();
  }, []);

  const veiculo = veiculos.find((v) => v.id === veiculoId);
  const motorista = motoristas.find((m) => m.id === motoristaId);

  const minutasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return minutas.filter((m) => {
      if (origem && m.origem.toLowerCase() !== origem.toLowerCase()) return false;
      if (destino && m.destino.toLowerCase() !== destino.toLowerCase()) return false;
      if (!q) return true;
      return String(m.numero).includes(q) || (m.tms_clientes?.nome ?? "").toLowerCase().includes(q);
    });
  }, [minutas, busca, origem, destino]);

  const totais = useMemo(() => {
    const sel = minutas.filter((m) => selecionadas.has(m.id));
    return {
      qtd: sel.length,
      volumes: sel.reduce((a, m) => a + Number(m.qtd_volumes || 0), 0),
      peso: sel.reduce((a, m) => a + Number(m.peso_taxado || 0), 0),
      cubagem: sel.reduce((a, m) => a + Number(m.cubagem || 0), 0),
      clientes: new Set(sel.map((m) => m.tms_clientes?.nome).filter(Boolean)).size,
    };
  }, [minutas, selecionadas]);

  function toggle(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  }
  function selecionarTodas() { setSelecionadas(new Set(minutasFiltradas.map((m) => m.id))); }
  function limpar() { setSelecionadas(new Set()); }

  async function aplicarViagemPlanejada(id: string) {
    setViagemSel(id);
    const v = viagensPlanejadas.find((x) => x.id === id);
    if (!v) return;
    setOrigem(v.origem); setDestino(v.destino); setRota(v.rota ?? "");
    if (v.motorista_id) setMotoristaId(v.motorista_id);
    if (v.veiculo_id) setVeiculoId(v.veiculo_id);
    if (v.data_prevista) setDataPrev(v.data_prevista.slice(0,16));
    const { data: links } = await supabase.from("tms_viagem_minutas").select("minuta_id").eq("viagem_id", id);
    setSelecionadas(new Set((links ?? []).map((l: any) => l.minuta_id)));
  }

  async function iniciarFn() {
    if (selecionadas.size === 0) { toast.error("Selecione ao menos 1 minuta"); return; }
    setLoading(true);
    try {
      const res = await iniciar({ data: {
        origem, destino, rota: rota || null,
        motorista_id: motoristaId || null,
        motorista_nome: motorista?.nome ?? null,
        veiculo_id: veiculoId || null,
        placa: veiculo?.placa ?? null,
        data_prevista: dataPrev ? new Date(dataPrev).toISOString() : null,
        minuta_ids: Array.from(selecionadas),
        viagem_id: viagemSel || null,
        observacoes: obs || null,
      }});
      const { data: v } = await supabase.from("tms_viagens").select("id, codigo").eq("id", res.viagem_id!).single();
      toast.success(`Viagem ${(v as any).codigo} iniciada`);
      onIniciada({ id: (v as any).id, codigo: (v as any).codigo });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar");
    } finally { setLoading(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="size-4 text-brand" /> Configurar viagem</h3>
            {viagensPlanejadas.length > 0 && (
              <select value={viagemSel} onChange={(e) => aplicarViagemPlanejada(e.target.value)}
                className="text-xs bg-background ring-1 ring-border rounded-md px-2 py-1">
                <option value="">Nova viagem</option>
                {viagensPlanejadas.map((v) => <option key={v.id} value={v.id}>{v.codigo} · {v.origem}→{v.destino}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <Field label="Origem"><input value={origem} onChange={(e) => setOrigem(e.target.value)} className={inputCls} /></Field>
            <Field label="Destino"><input value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} /></Field>
            <Field label="Rota"><input value={rota} onChange={(e) => setRota(e.target.value)} placeholder="ex: BR-060" className={inputCls} /></Field>
            <Field label="Motorista">
              <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Field>
            <Field label="Veículo">
              <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} · {v.modelo ?? ""}</option>)}
              </select>
            </Field>
            <Field label="Horário previsto">
              <input type="datetime-local" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Observações"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inputCls} /></Field>
        </div>

        <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Minutas disponíveis ({minutasFiltradas.length})</div>
            <div className="flex items-center gap-2">
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº/cliente"
                className="text-xs bg-background ring-1 ring-border rounded-md px-2 py-1 w-40" />
              <button onClick={selecionarTodas} className="text-[10px] uppercase px-2 py-1 rounded ring-1 ring-border">Todas</button>
              <button onClick={limpar} className="text-[10px] uppercase px-2 py-1 rounded ring-1 ring-border">Limpar</button>
            </div>
          </div>
          <div className="max-h-[42vh] overflow-y-auto thin-scroll divide-y divide-border/40">
            {minutasFiltradas.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma minuta disponível para {origem} → {destino}.</div>}
            {minutasFiltradas.map((m) => {
              const ck = selecionadas.has(m.id);
              return (
                <label key={m.id} className={`px-3 py-2 flex items-center gap-3 text-xs cursor-pointer ${ck ? "bg-brand/5" : "hover:bg-white/5"}`}>
                  <input type="checkbox" checked={ck} onChange={() => toggle(m.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">#{m.numero} · {m.tms_clientes?.nome ?? "—"}</div>
                    <div className="text-muted-foreground">{m.origem} → {m.destino}</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div>{m.qtd_volumes} vol</div>
                    <div className="text-muted-foreground">{Number(m.peso_taxado).toFixed(0)} kg</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4 self-start space-y-3">
        <h3 className="text-sm font-semibold">Resumo previsto</h3>
        <Kpi label="Minutas" value={totais.qtd} />
        <Kpi label="Clientes" value={totais.clientes} />
        <Kpi label="Volumes" value={totais.volumes} hl />
        <Kpi label="Peso" value={`${totais.peso.toFixed(1)} kg`} />
        <Kpi label="Cubagem" value={`${totais.cubagem.toFixed(3)} m³`} />
        {veiculo && (
          <div className="text-[10px] text-muted-foreground">
            Capacidade: {Number(veiculo.capacidade_kg).toFixed(0)} kg
            {totais.peso > Number(veiculo.capacidade_kg) && Number(veiculo.capacidade_kg) > 0 && (
              <span className="block text-rose-300">⚠ Peso excede capacidade</span>
            )}
          </div>
        )}
        <button onClick={iniciarFn} disabled={loading || totais.qtd === 0}
          className="w-full mt-2 px-3 py-2.5 rounded-md bg-brand text-brand-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <Play className="size-4" /> {loading ? "Iniciando…" : "Iniciar embarque"}
        </button>
      </aside>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Operação (bipagem + painel)
// -----------------------------------------------------------------------------
type Leitura = { id: string; codigo: string; ok: boolean; msg: string; ts: number };

function EmbarqueOperacao({ viagemId, onSair }: { viagemId: string; onSair: () => void }) {
  const bip = useServerFn(bipVolumeEmbarque);
  const finalizar = useServerFn(finalizarEmbarque);
  const [painel, setPainel] = useState<any>(null);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [tab, setTab] = useState<"pendentes" | "embarcados" | "duplicados" | "bloqueados" | "cancelados">("pendentes");
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [bipadosNessa] = useState(() => new Set<string>());
  const [tempo, setTempo] = useState("00:00");
  const operadorRef = useRef<string>("Você");

  const getPainel = useServerFn(getPainelViagem);

  async function load() {
    try {
      const r: any = await getPainel({ data: { viagem_id: viagemId } });
      setPainel(r);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao carregar painel"); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [viagemId]);

  // cronômetro
  useEffect(() => {
    if (!painel?.viagem?.iniciada_em) return;
    const ini = new Date(painel.viagem.iniciada_em).getTime();
    const t = setInterval(() => {
      const diff = Math.max(0, Date.now() - ini);
      const min = Math.floor(diff / 60000);
      const seg = Math.floor((diff % 60000) / 1000);
      setTempo(`${String(min).padStart(2,"0")}:${String(seg).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, [painel?.viagem?.iniciada_em]);

  async function processar(codigo: string) {
    const norm = codigo.trim();
    if (bipadosNessa.has(norm)) {
      playBeep("erro");
      setLeituras((l) => [{ id: crypto.randomUUID(), codigo: norm, ok: false, msg: "DUPLICADO — já bipado nessa sessão", ts: Date.now() }, ...l].slice(0, 100));
      toast.error("Volume duplicado");
      return;
    }
    try {
      const r: any = await bip({ data: { viagem_id: viagemId, codigo: norm } });
      if (r.ok) {
        bipadosNessa.add(norm);
        playBeep("ok");
        setLeituras((l) => [{ id: crypto.randomUUID(), codigo: norm, ok: true,
          msg: `#${r.minuta.numero} · ${r.minuta.cliente ?? ""} → ${r.minuta.destino}`, ts: Date.now() }, ...l].slice(0, 100));
        load();
      } else {
        playBeep("erro");
        setLeituras((l) => [{ id: crypto.randomUUID(), codigo: norm, ok: false, msg: r.motivo, ts: Date.now() }, ...l].slice(0, 100));
        toast.error(r.motivo);
      }
    } catch (e: any) {
      playBeep("erro");
      const msg = e?.message ?? "Falha na leitura";
      setLeituras((l) => [{ id: crypto.randomUUID(), codigo: norm, ok: false, msg, ts: Date.now() }, ...l].slice(0, 100));
      toast.error(msg);
    }
  }

  async function tentarFinalizar(forcar = false) {
    try {
      const r: any = await finalizar({ data: { viagem_id: viagemId, forcar } });
      if (!r.ok) { setPendentesCount(r.pendentes); setFinalizarOpen(true); return; }
      toast.success(`Viagem finalizada · ${r.resumo.embarcados}/${r.resumo.previstos} volumes`);
      onSair();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao finalizar"); }
  }

  if (!painel) return <div className="text-sm text-muted-foreground">Carregando painel…</div>;

  const v = painel.viagem;
  const vols = painel.volumes as any[];
  const embarcados = vols.filter((x) => x.status === "embarcado" && x.viagem_id === viagemId);
  const pendentes = vols.filter((x) => x.status !== "embarcado" && x.status !== "cancelado" && !x.bloqueado);
  const bloqueados = vols.filter((x) => x.bloqueado);
  const cancelados = vols.filter((x) => x.status === "cancelado");
  const duplicados = leituras.filter((l) => !l.ok && /duplicado|já embarcado/i.test(l.msg));
  const pct = v.qtd_volumes_prev > 0 ? Math.round((embarcados.length / v.qtd_volumes_prev) * 100) : 0;

  const tabData =
    tab === "pendentes" ? pendentes :
    tab === "embarcados" ? embarcados :
    tab === "bloqueados" ? bloqueados :
    tab === "cancelados" ? cancelados :
    duplicados.map((d) => ({ id: d.id, codigo: d.codigo, numero: "—", status: "duplicado" }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <ScanInput onScan={processar} placeholder={`Bipe um volume da viagem ${v.codigo}…`} />
        <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground flex justify-between">
            <span>Leituras ({leituras.length})</span>
            <span>OK {leituras.filter(l=>l.ok).length} · Erros {leituras.filter(l=>!l.ok).length}</span>
          </div>
          <div className="max-h-[50vh] overflow-y-auto thin-scroll divide-y divide-border/40">
            {leituras.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Pronto para bipar.</div>}
            {leituras.map((l) => (
              <div key={l.id} className={`px-3 py-2 text-xs flex items-start gap-2 ${l.ok ? "" : "bg-rose-500/10"}`}>
                {l.ok ? <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-muted-foreground">{l.codigo} · {new Date(l.ts).toLocaleTimeString("pt-BR")}</div>
                  <div className={l.ok ? "" : "text-rose-300 font-medium"}>{l.msg}</div>
                </div>
                <span className="text-[10px] text-muted-foreground">{operadorRef.current}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
          <div className="border-b border-border flex text-[10px] uppercase">
            {(["pendentes","embarcados","duplicados","bloqueados","cancelados"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-2 ${tab===k ? "text-brand border-b-2 border-brand" : "text-muted-foreground"}`}>
                {k} ({k==="pendentes"?pendentes.length:k==="embarcados"?embarcados.length:k==="duplicados"?duplicados.length:k==="bloqueados"?bloqueados.length:cancelados.length})
              </button>
            ))}
          </div>
          <div className="max-h-[28vh] overflow-y-auto thin-scroll divide-y divide-border/40">
            {tabData.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">—</div>}
            {tabData.map((x: any) => (
              <div key={x.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                <Package className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px]">{x.codigo}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{x.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4 self-start space-y-3 lg:sticky lg:top-16">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Viagem</div>
            <div className="text-lg font-bold text-brand">{v.codigo}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1 justify-end"><Clock className="size-3" /> tempo</div>
            <div className="text-lg font-bold tabular-nums">{tempo}</div>
          </div>
        </div>

        <div className="text-xs space-y-0.5">
          <div><span className="text-muted-foreground">Motorista:</span> {v.motorista_nome ?? "—"}</div>
          <div><span className="text-muted-foreground">Placa:</span> {v.placa ?? "—"}</div>
          <div><span className="text-muted-foreground">Rota:</span> {v.origem} → {v.destino} {v.rota ? `· ${v.rota}` : ""}</div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] uppercase text-muted-foreground mb-1">
            <span>Embarcados</span><span>{embarcados.length}/{v.qtd_volumes_prev}</span>
          </div>
          <div className="h-2 rounded-full bg-background overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-right text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <Mini label="Previstos" value={v.qtd_volumes_prev} />
          <Mini label="Restantes" value={Math.max(0, v.qtd_volumes_prev - embarcados.length)} alert={pendentes.length > 0} />
          <Mini label="Peso prev" value={`${Number(v.peso_prev).toFixed(0)}kg`} />
          <Mini label="Peso emb" value={`${Number(v.peso_emb).toFixed(0)}kg`} />
        </div>

        <div className="text-xs">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Minutas ({painel.minutas.length})</div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto thin-scroll">
            {painel.minutas.map((m: any) => (
              <Link key={m.id} to="/tms/minutas/$numero" params={{ numero: String(m.numero) }}
                className="px-1.5 py-0.5 rounded bg-background text-[10px] hover:bg-brand/10">#{m.numero}</Link>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onSair} className="flex-1 px-3 py-2 text-xs rounded-md ring-1 ring-border">Pausar</button>
          <button onClick={() => tentarFinalizar(false)}
            className="flex-1 px-3 py-2 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5">
            <Flag className="size-3.5" /> Finalizar
          </button>
        </div>
      </aside>

      <Dialog open={finalizarOpen} onOpenChange={setFinalizarOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-300 flex items-center gap-2"><AlertTriangle className="size-4" /> Volumes pendentes</DialogTitle>
            <DialogDescription>Existem <b>{pendentesCount}</b> volumes não embarcados. Eles serão registrados como ocorrência "ficou no HUB" e o tracking será atualizado.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setFinalizarOpen(false)} className="px-3 py-1.5 text-sm rounded-md ring-1 ring-border">Voltar e bipar</button>
            <button onClick={() => { setFinalizarOpen(false); tentarFinalizar(true); }}
              className="px-3 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-500 text-white">Finalizar assim mesmo</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
const inputCls = "w-full bg-background ring-1 ring-border rounded-md px-2.5 py-1.5 text-xs";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Kpi({ label, value, hl }: { label: string; value: any; hl?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${hl ? "text-brand text-lg" : ""}`}>{value}</span>
    </div>
  );
}
function Mini({ label, value, alert }: { label: string; value: any; alert?: boolean }) {
  return (
    <div className={`rounded-md bg-background ring-1 ring-border p-2 ${alert ? "ring-rose-500/50" : ""}`}>
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-bold tabular-nums ${alert ? "text-rose-300" : ""}`}>{value}</div>
    </div>
  );
}
