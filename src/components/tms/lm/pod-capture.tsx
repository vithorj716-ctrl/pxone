import { useRef, useState } from "react";
import { Camera, FileSignature, MapPin, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PodCapture({ entregaId, onSaved }: { entregaId: string; onSaved?: () => void }) {
  const [recebedor, setRecebedor] = useState("");
  const [doc, setDoc] = useState("");
  const [obs, setObs] = useState("");
  const [fotoMerc, setFotoMerc] = useState<string | null>(null);
  const [fotoFach, setFotoFach] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  async function upload(file: File, tag: string): Promise<string | null> {
    const path = `entrega_${entregaId}/${tag}_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("pod-lastmile").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return null; }
    return path;
  }

  function pegarGps() {
    if (!navigator.geolocation) return toast.error("GPS indisponível");
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Falha ao obter GPS"),
    );
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); drawing.current = true;
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  }
  function endDraw() {
    drawing.current = false;
    setAssinatura(canvasRef.current?.toDataURL("image/png") ?? null);
  }
  function clearSig() {
    const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setAssinatura(null);
  }

  async function salvar() {
    setSaving(true);
    try {
      const { error } = await supabase.from("tms_lm_comprovantes").insert({
        entrega_id: entregaId,
        recebedor_nome: recebedor || null,
        recebedor_doc: doc || null,
        foto_mercadoria: fotoMerc,
        foto_fachada: fotoFach,
        assinatura_base64: assinatura,
        observacoes: obs || null,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
      });
      if (error) throw error;
      await supabase.from("tms_lm_entregas").update({ status: "entregue", concluida_em: new Date().toISOString() }).eq("id", entregaId);
      await supabase.from("tms_lm_eventos").insert({ entrega_id: entregaId, tipo: "entregue", payload: { recebedor, doc } });

      // Verifica se todas as entregas da rota foram concluídas → finaliza rota + lança receita
      const { data: ent } = await supabase.from("tms_lm_entregas").select("rota_id").eq("id", entregaId).maybeSingle();
      const rotaId = (ent as any)?.rota_id as string | undefined;
      if (rotaId) {
        const { data: irmas } = await supabase.from("tms_lm_entregas").select("status").eq("rota_id", rotaId);
        const todas = (irmas ?? []) as { status: string }[];
        if (todas.length > 0 && todas.every((e) => e.status === "entregue")) {
          const { data: rota } = await supabase.from("tms_lm_rotas")
            .select("id, numero, valor_rota, faturavel, empresa_id, status")
            .eq("id", rotaId).maybeSingle();
          await supabase.from("tms_lm_rotas").update({
            status: "finalizada", hora_finalizada: new Date().toISOString(),
          }).eq("id", rotaId);
          if (rota && (rota as any).faturavel && Number((rota as any).valor_rota) > 0 && (rota as any).status !== "finalizada") {
            await supabase.from("custos").insert({
              nome: `Receita Last Mile — Rota #${(rota as any).numero}`,
              descricao: `[LM] Rota ${(rota as any).numero} finalizada com ${todas.length} entrega(s)`,
              valor: Number((rota as any).valor_rota),
              empresa_id: (rota as any).empresa_id ?? null,
              tipo_custo: "unico",
              status: "pago",
              centro_custo: "Receita Last Mile",
            });
          }
        }
      }

      toast.success("Comprovante salvo");
      onSaved?.();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={recebedor} onChange={(e) => setRecebedor(e.target.value)} placeholder="Nome do recebedor" className="px-3 py-2 bg-surface ring-1 ring-border rounded" />
        <input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Documento" className="px-3 py-2 bg-surface ring-1 ring-border rounded" />
      </div>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações" className="w-full px-3 py-2 bg-surface ring-1 ring-border rounded" rows={2} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 px-3 py-2 bg-surface ring-1 ring-border rounded cursor-pointer text-sm">
          <Camera className="size-4" /> {fotoMerc ? "Mercadoria ✓" : "Foto mercadoria"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => e.target.files?.[0] && setFotoMerc(await upload(e.target.files[0], "merc"))} />
        </label>
        <label className="flex items-center gap-2 px-3 py-2 bg-surface ring-1 ring-border rounded cursor-pointer text-sm">
          <Camera className="size-4" /> {fotoFach ? "Fachada ✓" : "Foto fachada"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => e.target.files?.[0] && setFotoFach(await upload(e.target.files[0], "fach"))} />
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1"><FileSignature className="size-3.5" /> Assinatura</span>
          <button onClick={clearSig} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>
        </div>
        <canvas
          ref={canvasRef} width={500} height={160}
          className="w-full bg-white rounded touch-none"
          onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerLeave={endDraw}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <button onClick={pegarGps} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <MapPin className="size-3.5" /> {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Capturar GPS"}
        </button>
      </div>

      <button onClick={salvar} disabled={saving} className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        <Save className="size-4" /> {saving ? "Salvando..." : "Concluir entrega"}
      </button>
    </div>
  );
}
