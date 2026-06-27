import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Timeline } from "@/components/tms/timeline";
import { STATUS_VOL_LABEL } from "@/lib/tms";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/tracking")({
  head: () => ({ meta: [{ title: "PXLog — Tracking" }] }),
  component: TrackingPage,
});

function TrackingPage() {
  const [q, setQ] = useState("");
  const [minuta, setMinuta] = useState<any | null>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function loadEventos(minutaId: string) {
    const { data: vols } = await supabase.from("tms_volumes").select("id").eq("minuta_id", minutaId);
    const volIds = ((vols ?? []) as any[]).map((x) => x.id);
    const q = supabase.from("tms_eventos").select("*").order("created_at");
    const { data } = volIds.length
      ? await q.or(`minuta_id.eq.${minutaId},volume_id.in.(${volIds.join(",")})`)
      : await q.eq("minuta_id", minutaId);
    return (data ?? []) as any[];
  }

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const v = q.trim();
    if (!v) return;
    setLoading(true); setErro(null); setMinuta(null); setEventos([]);

    // Tentar como código de volume
    if (v.startsWith("PXLOG-")) {
      const { data: vol } = await supabase.from("tms_volumes").select("minuta_id").eq("codigo", v).maybeSingle();
      if (vol) {
        const { data: m } = await supabase.from("tms_minutas").select("*, tms_clientes(nome)").eq("id", (vol as any).minuta_id).maybeSingle();
        if (m) {
          setMinuta(m);
          setEventos(await loadEventos((m as any).id));
          setLoading(false);
          return;
        }
      }
    }

    // Tentar como número da minuta
    const num = Number(v.replace(/[^\d]/g, ""));
    if (num) {
      const { data: m } = await supabase.from("tms_minutas").select("*, tms_clientes(nome)").eq("numero", num).maybeSingle();
      if (m) {
        setMinuta(m);
        setEventos(await loadEventos((m as any).id));
        setLoading(false);
        return;
      }
    }
    setErro("Nenhuma minuta ou volume encontrado");
    setLoading(false);
  }

  const st = minuta ? STATUS_VOL_LABEL[minuta.status] : null;

  return (
    <TmsShell title="Tracking" subtitle="Busque por número da minuta ou código do volume">
      <form onSubmit={buscar} className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: 1042 ou PXLOG-0001042-001"
          className="w-full pl-9 pr-3 py-2.5 bg-surface ring-1 ring-border rounded-md text-sm" />
      </form>

      {loading && <div className="text-xs text-muted-foreground">Buscando…</div>}
      {erro && <div className="text-xs text-rose-400">{erro}</div>}

      {minuta && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl ring-1 ring-border bg-surface/60 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <Link to="/tms/minutas/$numero" params={{ numero: String(minuta.numero) }}
                className="text-base font-semibold text-brand hover:underline">Minuta #{minuta.numero}</Link>
              <span className={`text-[10px] px-2 py-0.5 rounded ${st?.cor || "bg-muted"}`}>{st?.label || minuta.status}</span>
            </div>
            <div className="text-muted-foreground">{minuta.tms_clientes?.nome ?? "—"}</div>
            <div>{minuta.origem} → {minuta.destino}</div>
            <div>{minuta.qtd_volumes} volumes · {Number(minuta.peso_taxado).toFixed(1)} kg</div>
          </div>
          <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
            <h3 className="text-sm font-semibold mb-3">Linha do tempo</h3>
            <Timeline eventos={eventos} />
          </aside>
        </div>
      )}
    </TmsShell>
  );
}
