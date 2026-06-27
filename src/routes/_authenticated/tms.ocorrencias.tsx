import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/ocorrencias")({
  head: () => ({ meta: [{ title: "PXLog — Ocorrências" }] }),
  component: OcorrenciasPage,
});

const TIPOS = [
  "Avaria", "Extravio", "Recusa", "Endereço incorreto",
  "Falta de volumes", "Volume excedente", "Cliente ausente", "Outros",
];

function OcorrenciasPage() {
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [obs, setObs] = useState("");
  const [hist, setHist] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("tms_eventos").select("*, tms_volumes(codigo), tms_minutas(numero)")
      .eq("tipo", "ocorrencia").order("created_at", { ascending: false }).limit(50);
    setHist((data ?? []) as any[]);
  }
  useEffect(() => { void load(); }, []);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    const code = codigo.trim();
    let volume_id: string | null = null;
    let minuta_id: string | null = null;
    if (code.startsWith("PXLOG-")) {
      const { data: vol } = await supabase.from("tms_volumes").select("id, minuta_id").eq("codigo", code).maybeSingle();
      if (!vol) { toast.error("Volume não encontrado"); return; }
      volume_id = (vol as any).id; minuta_id = (vol as any).minuta_id;
    } else {
      const n = Number(code.replace(/[^\d]/g, ""));
      const { data: m } = await supabase.from("tms_minutas").select("id").eq("numero", n).maybeSingle();
      if (!m) { toast.error("Minuta não encontrada"); return; }
      minuta_id = (m as any).id;
    }
    await supabase.from("tms_eventos").insert({
      minuta_id, volume_id, tipo: "ocorrencia",
      origem_evento: tipo, payload: { observacao: obs },
    });
    if (volume_id) await supabase.from("tms_volumes").update({ status: "ocorrencia" }).eq("id", volume_id);
    toast.success("Ocorrência registrada");
    setCodigo(""); setObs("");
    void load();
  }

  return (
    <TmsShell title="Ocorrências" subtitle="Registro rápido de ocorrências operacionais">
      <form onSubmit={registrar} className="rounded-xl ring-1 ring-border bg-surface/60 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Código do volume ou número da minuta</label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required
            className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm">
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <button type="submit" className="self-end inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-brand text-brand-foreground text-sm">
          <AlertTriangle className="size-4" /> Registrar
        </button>
        <div className="md:col-span-4">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observação</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
            className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm" />
        </div>
      </form>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">Histórico recente</div>
        <div className="divide-y divide-border/40">
          {hist.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma ocorrência registrada.</div>
          ) : hist.map((h: any) => (
            <div key={h.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{h.origem_evento}</div>
                <div className="text-muted-foreground truncate">
                  {h.tms_minutas?.numero && `Minuta #${h.tms_minutas.numero} · `}
                  {h.tms_volumes?.codigo}
                  {h.payload?.observacao && ` — ${h.payload.observacao}`}
                </div>
              </div>
              <time className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {new Date(h.created_at).toLocaleString("pt-BR", { hour12: false })}
              </time>
            </div>
          ))}
        </div>
      </div>
    </TmsShell>
  );
}
