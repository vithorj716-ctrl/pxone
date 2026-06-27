import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, User, Truck, Route as RouteIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/tms/lm/configuracoes")({
  head: () => ({ meta: [{ title: "Last Mile — Configurações" }] }),
  component: LmConfig,
});

function LmConfig() {
  const [tab, setTab] = useState<"motoristas" | "veiculos" | "rotas">("motoristas");
  const qc = useQueryClient();
  const { data: mots } = useQuery({ queryKey: ["lm-mots"], queryFn: async () => (await supabase.from("tms_lm_motoristas").select("*").order("nome")).data ?? [] });
  const { data: veics } = useQuery({ queryKey: ["lm-veics"], queryFn: async () => (await supabase.from("tms_lm_veiculos").select("*").order("placa")).data ?? [] });
  const { data: rotas } = useQuery({ queryKey: ["lm-rotas-cfg"], queryFn: async () => (await supabase.from("tms_lm_rotas").select("*, tms_lm_motoristas(nome), tms_lm_veiculos(placa)").order("data", { ascending: false }).limit(50)).data ?? [] });

  const [openMot, setOpenMot] = useState(false);
  const [openVeic, setOpenVeic] = useState(false);
  const [openRota, setOpenRota] = useState(false);

  return (
    <TmsShell title="Last Mile" subtitle="Configurações">
      <div className="flex gap-1.5">
        {(["motoristas", "veiculos", "rotas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-xs uppercase tracking-wider font-bold ${tab === t ? "bg-foreground text-background" : "bg-surface ring-1 ring-border"}`}>{t}</button>
        ))}
      </div>

      {tab === "motoristas" && (
        <>
          <button onClick={() => setOpenMot(true)} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Novo motorista</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(mots ?? []).map((m: any) => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3"><User className="size-4 text-muted-foreground" /><span className="flex-1">{m.nome}</span><span className="text-xs text-muted-foreground">{m.telefone ?? "—"}</span></div>
            ))}
            {!mots?.length && <div className="px-4 py-8 text-center text-muted-foreground">Sem motoristas</div>}
          </div>
        </>
      )}
      {tab === "veiculos" && (
        <>
          <button onClick={() => setOpenVeic(true)} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Novo veículo</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(veics ?? []).map((v: any) => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3"><Truck className="size-4 text-muted-foreground" /><span className="font-mono font-bold">{v.placa}</span><span className="flex-1 text-muted-foreground">{v.modelo}</span><span className="text-xs">{v.capacidade_kg ?? 0}kg</span></div>
            ))}
            {!veics?.length && <div className="px-4 py-8 text-center text-muted-foreground">Sem veículos</div>}
          </div>
        </>
      )}
      {tab === "rotas" && (
        <>
          <button onClick={() => setOpenRota(true)} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Nova rota</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(rotas ?? []).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <RouteIcon className="size-4 text-muted-foreground" />
                <span className="font-mono font-bold">#{r.numero}</span>
                <span className="flex-1">{r.cidade ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{r.tms_lm_motoristas?.nome ?? "—"} · {r.tms_lm_veiculos?.placa ?? "—"}</span>
                <span className="text-xs uppercase">{r.status}</span>
              </div>
            ))}
            {!rotas?.length && <div className="px-4 py-8 text-center text-muted-foreground">Sem rotas</div>}
          </div>
        </>
      )}

      <MotoristaDialog open={openMot} onOpenChange={setOpenMot} onSaved={() => qc.invalidateQueries({ queryKey: ["lm-mots"] })} />
      <VeiculoDialog open={openVeic} onOpenChange={setOpenVeic} onSaved={() => qc.invalidateQueries({ queryKey: ["lm-veics"] })} />
      <RotaDialog open={openRota} onOpenChange={setOpenRota} motoristas={mots ?? []} veiculos={veics ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ["lm-rotas-cfg"] })} />
    </TmsShell>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full mt-1 px-3 py-2 bg-surface ring-1 ring-border rounded text-sm";

function MotoristaDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState({ nome: "", telefone: "", cpf: "", cnh: "" });
  async function salvar() {
    if (!f.nome) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("tms_lm_motoristas").insert({ nome: f.nome, telefone: f.telefone || null, cpf: f.cpf || null, cnh: f.cnh || null, ativo: true });
    if (error) return toast.error(error.message);
    toast.success("Motorista criado");
    setF({ nome: "", telefone: "", cpf: "", cnh: "" }); onOpenChange(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo motorista</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome *" span={2}><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="Telefone"><input className={inputCls} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Field>
          <Field label="CPF"><input className={inputCls} value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Field>
          <Field label="CNH" span={2}><input className={inputCls} value={f.cnh} onChange={(e) => setF({ ...f, cnh: e.target.value })} /></Field>
        </div>
        <button onClick={salvar} className="w-full mt-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold">Criar</button>
      </DialogContent>
    </Dialog>
  );
}

function VeiculoDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [f, setF] = useState({ placa: "", modelo: "", capacidade_kg: 0 });
  async function salvar() {
    if (!f.placa) return toast.error("Placa obrigatória");
    const { error } = await supabase.from("tms_lm_veiculos").insert({ placa: f.placa.toUpperCase(), modelo: f.modelo || null, capacidade_kg: f.capacidade_kg || 0, ativo: true });
    if (error) return toast.error(error.message);
    toast.success("Veículo criado");
    setF({ placa: "", modelo: "", capacidade_kg: 0 }); onOpenChange(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Placa *"><input className={inputCls} value={f.placa} onChange={(e) => setF({ ...f, placa: e.target.value })} /></Field>
          <Field label="Capacidade (kg)"><input type="number" className={inputCls} value={f.capacidade_kg} onChange={(e) => setF({ ...f, capacidade_kg: Number(e.target.value) })} /></Field>
          <Field label="Modelo" span={2}><input className={inputCls} value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} /></Field>
        </div>
        <button onClick={salvar} className="w-full mt-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold">Criar</button>
      </DialogContent>
    </Dialog>
  );
}

function RotaDialog({ open, onOpenChange, onSaved, motoristas, veiculos }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; motoristas: any[]; veiculos: any[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ cidade: "", data: today, motorista_id: "", veiculo_id: "", valor_rota: 0, faturavel: true });
  async function salvar() {
    const { error } = await supabase.from("tms_lm_rotas").insert({
      cidade: f.cidade || null, data: f.data,
      motorista_id: f.motorista_id || null, veiculo_id: f.veiculo_id || null,
      valor_rota: f.valor_rota || 0, faturavel: f.faturavel, status: "planejada",
    });
    if (error) return toast.error(error.message);
    toast.success("Rota criada");
    setF({ cidade: "", data: today, motorista_id: "", veiculo_id: "", valor_rota: 0, faturavel: true });
    onOpenChange(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova rota</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade" span={2}><input className={inputCls} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Field>
          <Field label="Data"><input type="date" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
          <Field label="Valor (R$)"><input type="number" step="0.01" className={inputCls} value={f.valor_rota} onChange={(e) => setF({ ...f, valor_rota: Number(e.target.value) })} /></Field>
          <Field label="Motorista">
            <select className={inputCls} value={f.motorista_id} onChange={(e) => setF({ ...f, motorista_id: e.target.value })}>
              <option value="">—</option>
              {motoristas.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
          <Field label="Veículo">
            <select className={inputCls} value={f.veiculo_id} onChange={(e) => setF({ ...f, veiculo_id: e.target.value })}>
              <option value="">—</option>
              {veiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ?? ""}</option>)}
            </select>
          </Field>
          <Field label="Faturável" span={2}>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={f.faturavel} onChange={(e) => setF({ ...f, faturavel: e.target.checked })} />
              Lançar receita na Central de Custos ao finalizar
            </label>
          </Field>
        </div>
        <button onClick={salvar} className="w-full mt-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold">Criar rota</button>
      </DialogContent>
    </Dialog>
  );
}
