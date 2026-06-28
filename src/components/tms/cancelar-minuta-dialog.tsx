import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cancelarMinuta, MOTIVOS_CANCELAMENTO } from "@/lib/tms-minutas.functions";
import { toast } from "sonner";
import { Ban } from "lucide-react";

export function CancelarMinutaDialog({ open, onOpenChange, minutaId, numero, onCancelled }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  minutaId: string;
  numero: number | string;
  onCancelled?: () => void;
}) {
  const cancelar = useServerFn(cancelarMinuta);
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!motivo) { toast.error("Selecione um motivo"); return; }
    if (!confirma) { toast.error("Confirme a ação"); return; }
    setLoading(true);
    try {
      await cancelar({ data: { minuta_id: minutaId, motivo, motivo_texto: texto || undefined } });
      toast.success(`Minuta #${numero} cancelada`);
      onOpenChange(false);
      onCancelled?.();
      navigate({ to: "/tms/minutas/$numero", params: { numero: String(numero) } });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao cancelar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <Ban className="size-4" /> Cancelar minuta #{numero}
          </DialogTitle>
          <DialogDescription>O registro é preservado para auditoria. Etiquetas, tracking, embarque e faturamento ficam bloqueados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Motivo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className="w-full mt-1 bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm">
              <option value="">Selecione…</option>
              {MOTIVOS_CANCELAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Detalhes (opcional)</label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
              className="w-full mt-1 bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm" />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} className="mt-0.5" />
            <span>Confirmo o cancelamento. Esta ação ficará registrada.</span>
          </label>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-3 py-1.5 text-sm rounded-md ring-1 ring-border">Voltar</button>
          <button onClick={submit} disabled={loading || !motivo || !confirma}
            className="px-3 py-1.5 text-sm rounded-md bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50">
            {loading ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
