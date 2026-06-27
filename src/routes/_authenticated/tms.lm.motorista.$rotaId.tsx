import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Phone, CheckCircle2, AlertTriangle, Camera, FileSignature, Play, Navigation } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PodCapture } from "@/components/tms/lm/pod-capture";

export const Route = createFileRoute("/_authenticated/tms/lm/motorista/$rotaId")({
  head: () => ({ meta: [{ title: "Motorista — Próxima Entrega" }] }),
  component: MotView,
});

function MotView() {
  const { rotaId } = Route.useParams();
  const [pod, setPod] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["mot-view", rotaId],
    queryFn: async () => {
      const { data } = await supabase.from("tms_lm_entregas").select("*").eq("rota_id", rotaId).neq("status", "entregue").order("ordem").limit(1).maybeSingle();
      return data;
    },
  });

  if (!data) return <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
    <div><CheckCircle2 className="size-16 text-green-500 mx-auto mb-3" /><div className="text-2xl font-bold">Rota concluída</div><div className="text-muted-foreground text-sm mt-1">Todas as entregas foram finalizadas</div></div>
  </div>;

  const mapsUrl = data.lat && data.lng ? `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}` : data.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.endereco}, ${data.cidade ?? ""}`)}` : "#";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Próxima entrega</div>
      </header>
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        <div className="rounded-2xl bg-white/5 p-5 space-y-3">
          <div className="text-2xl font-bold">{data.destinatario}</div>
          <div className="flex items-start gap-2 text-sm"><MapPin className="size-4 mt-0.5 text-green-400 shrink-0" /><span>{data.endereco} — {data.cidade}</span></div>
          {data.telefone && <a href={`tel:${data.telefone}`} className="flex items-center gap-2 text-sm text-blue-400"><Phone className="size-4" /> {data.telefone}</a>}
          <div className="text-xs text-muted-foreground">{data.qtd_volumes} volumes · {data.peso}kg</div>
          {data.observacoes && <div className="text-xs italic bg-yellow-500/10 text-yellow-200 p-2 rounded">{data.observacoes}</div>}
        </div>

        <a href={mapsUrl} target="_blank" rel="noreferrer" className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold inline-flex items-center justify-center gap-2 text-lg">
          <Navigation className="size-5" /> Abrir no Mapa
        </a>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={async () => { await supabase.from("tms_lm_eventos").insert({ entrega_id: data.id, tipo: "cheguei" }); }} className="py-4 rounded-2xl bg-white/10 hover:bg-white/20 font-bold inline-flex items-center justify-center gap-2"><Play className="size-4" /> Cheguei</button>
          <button onClick={() => setPod(true)} className="py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold inline-flex items-center justify-center gap-2"><CheckCircle2 className="size-4" /> Concluir</button>
          <button onClick={async () => { const desc = prompt("Descrição"); if (!desc) return; await supabase.from("tms_lm_ocorrencias").insert({ entrega_id: data.id, tipo: "outros", descricao: desc }); refetch(); }} className="py-4 rounded-2xl bg-red-600/80 hover:bg-red-500 text-white font-bold inline-flex items-center justify-center gap-2"><AlertTriangle className="size-4" /> Ocorrência</button>
          <button onClick={() => setPod(true)} className="py-4 rounded-2xl bg-white/10 hover:bg-white/20 font-bold inline-flex items-center justify-center gap-2"><Camera className="size-4" /> Foto/Assinatura</button>
        </div>
      </main>

      <Dialog open={pod} onOpenChange={setPod}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comprovante</DialogTitle></DialogHeader>
          <PodCapture entregaId={data.id} onSaved={() => { setPod(false); refetch(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
