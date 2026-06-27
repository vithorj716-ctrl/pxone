import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function NovaEntregaDialog({
  rotaId,
  rotaNumero,
  onCreated,
}: { rotaId: string; rotaNumero: number; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    cliente_id: "",
    destinatario: "", telefone: "",
    endereco: "", cidade: "", uf: "",
    qtd_volumes: 1, peso: 0, cubagem: 0,
    valor_mercadoria: 0, prioridade: "media",
    observacoes: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("tms_clientes").select("id, nome").order("nome");
      setClientes((data ?? []) as any[]);
    })();
  }, [open]);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  async function salvar() {
    if (!f.destinatario) return toast.error("Destinatário obrigatório");
    if (f.qtd_volumes < 1) return toast.error("Quantidade de volumes inválida");
    setSaving(true);
    try {
      // próxima ordem
      const { data: existentes } = await supabase
        .from("tms_lm_entregas").select("ordem").eq("rota_id", rotaId)
        .order("ordem", { ascending: false }).limit(1);
      const proxOrdem = ((existentes ?? [])[0]?.ordem ?? 0) + 1;

      const { data: ent, error } = await supabase.from("tms_lm_entregas").insert({
        rota_id: rotaId,
        cliente_id: f.cliente_id || null,
        destinatario: f.destinatario,
        telefone: f.telefone || null,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        uf: f.uf || null,
        qtd_volumes: f.qtd_volumes,
        peso: f.peso,
        cubagem: f.cubagem,
        valor_mercadoria: f.valor_mercadoria,
        prioridade: f.prioridade,
        observacoes: f.observacoes || null,
        ordem: proxOrdem,
        status: "aguardando_separacao",
      }).select("id").single();
      if (error || !ent) throw error;

      const entregaSeq = String(proxOrdem).padStart(3, "0");
      const volumes = Array.from({ length: f.qtd_volumes }, (_, i) => ({
        entrega_id: ent.id,
        codigo: `LM-${rotaNumero}-${entregaSeq}-${String(i + 1).padStart(3, "0")}`,
        status: "aguardando_separacao",
      }));
      const { error: ve } = await supabase.from("tms_lm_volumes").insert(volumes);
      if (ve) throw ve;

      await supabase.from("tms_lm_eventos").insert({
        entrega_id: ent.id, rota_id: rotaId,
        tipo: "criada", payload: { ordem: proxOrdem, qtd_volumes: f.qtd_volumes },
      });

      toast.success(`Entrega #${proxOrdem} criada com ${f.qtd_volumes} volume(s)`);
      setOpen(false);
      setF({ ...f, destinatario: "", telefone: "", endereco: "", cidade: "", uf: "", observacoes: "", qtd_volumes: 1, peso: 0, cubagem: 0, valor_mercadoria: 0 });
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar entrega");
    } finally { setSaving(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white inline-flex items-center gap-1.5">
        <Plus className="size-3.5" /> Nova entrega
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova entrega · Rota #{rotaNumero}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Sel label="Cliente" value={f.cliente_id} onChange={(v) => set("cliente_id", v)}
              options={[{ value: "", label: "— Avulso —" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]} span={2} />
            <Inp label="Destinatário *" value={f.destinatario} onChange={(v) => set("destinatario", v)} span={2} />
            <Inp label="Telefone" value={f.telefone} onChange={(v) => set("telefone", v)} />
            <Sel label="Prioridade" value={f.prioridade} onChange={(v) => set("prioridade", v)}
              options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" }]} />
            <Inp label="Endereço" value={f.endereco} onChange={(v) => set("endereco", v)} span={2} />
            <Inp label="Cidade" value={f.cidade} onChange={(v) => set("cidade", v)} />
            <Inp label="UF" value={f.uf} onChange={(v) => set("uf", v)} />
            <Inp label="Qtd volumes *" type="number" value={f.qtd_volumes} onChange={(v) => set("qtd_volumes", Math.max(1, Number(v) || 1))} />
            <Inp label="Peso (kg)" type="number" step="0.01" value={f.peso} onChange={(v) => set("peso", Number(v))} />
            <Inp label="Cubagem (m³)" type="number" step="0.001" value={f.cubagem} onChange={(v) => set("cubagem", Number(v))} />
            <Inp label="Valor mercadoria" type="number" step="0.01" value={f.valor_mercadoria} onChange={(v) => set("valor_mercadoria", Number(v))} />
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</label>
              <textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2}
                className="w-full mt-1 px-3 py-2 bg-surface ring-1 ring-border rounded text-sm" />
            </div>
          </div>
          <button onClick={salvar} disabled={saving}
            className="w-full mt-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold disabled:opacity-50">
            {saving ? "Criando…" : "Criar entrega e gerar volumes"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Inp({ label, value, onChange, type = "text", step, span }: {
  label: string; value: any; onChange: (v: string) => void; type?: string; step?: string; span?: number;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 bg-surface ring-1 ring-border rounded text-sm" />
    </div>
  );
}
function Sel({ label, value, onChange, options, span }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; span?: number;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 bg-surface ring-1 ring-border rounded text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
