import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { LM_TIPOS_OCORRENCIA } from "@/lib/tms-lm";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/tms/lm/ocorrencias")({
  head: () => ({ meta: [{ title: "Last Mile — Ocorrências" }] }),
  component: LmOcor,
});

function LmOcor() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("ausente");
  const [entregaId, setEntregaId] = useState("");
  const [desc, setDesc] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["lm-ocor"],
    queryFn: async () => {
      const { data } = await supabase.from("tms_lm_ocorrencias").select("*, tms_lm_entregas(destinatario, cidade, tms_lm_rotas(numero))").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  async function salvar() {
    if (!entregaId) return toast.error("Informe a entrega");
    const { error } = await supabase.from("tms_lm_ocorrencias").insert({ entrega_id: entregaId, tipo, descricao: desc || null });
    if (error) return toast.error(error.message);
    await supabase.from("tms_lm_eventos").insert({ entrega_id: entregaId, tipo: `ocorrencia:${tipo}`, payload: { descricao: desc } });
    await supabase.from("tms_lm_entregas").update({ status: tipo === "ausente" ? "ausente" : tipo === "endereco_incorreto" ? "endereco_incorreto" : tipo === "avaria" ? "avaria" : "recusado" }).eq("id", entregaId);
    toast.success("Ocorrência registrada");
    setOpen(false); setDesc(""); setEntregaId(""); refetch();
  }

  return (
    <TmsShell title="Last Mile" subtitle="Ocorrências"
      headerActions={<button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Registrar</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data ?? []).map((o: any) => (
          <div key={o.id} className="rounded-xl ring-1 ring-border bg-surface p-4 flex gap-3" style={{ borderLeft: "4px solid #a855f7" }}>
            <AlertTriangle className="size-5 text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-purple-600 text-white font-bold">{LM_TIPOS_OCORRENCIA.find(t => t.key === o.tipo)?.label ?? o.tipo}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(o.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div className="font-semibold mt-1 truncate">{o.tms_lm_entregas?.destinatario ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{o.tms_lm_entregas?.cidade ?? ""} · Rota #{o.tms_lm_entregas?.tms_lm_rotas?.numero ?? "—"}</div>
              {o.descricao && <div className="text-xs mt-1 italic">{o.descricao}</div>}
            </div>
          </div>
        ))}
        {!data?.length && <div className="col-span-full text-center text-muted-foreground py-12">Nenhuma ocorrência</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={entregaId} onChange={(e) => setEntregaId(e.target.value)} placeholder="ID da entrega" className="w-full px-3 py-2 bg-surface ring-1 ring-border rounded" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 bg-surface ring-1 ring-border rounded">
              {LM_TIPOS_OCORRENCIA.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descrição" className="w-full px-3 py-2 bg-surface ring-1 ring-border rounded" />
            <button onClick={salvar} className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>
    </TmsShell>
  );
}
