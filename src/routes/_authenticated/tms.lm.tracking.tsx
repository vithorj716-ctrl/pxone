import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Timeline } from "@/components/tms/timeline";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/tms/lm/tracking")({
  head: () => ({ meta: [{ title: "Last Mile — Tracking" }] }),
  component: LmTracking,
});

function LmTracking() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["lm-tracking", q],
    queryFn: async () => {
      let query = supabase.from("tms_lm_eventos").select("id, tipo, created_at, payload, entrega_id, tms_lm_entregas(destinatario, cidade)").order("created_at", { ascending: false }).limit(200);
      const { data } = await query;
      return (data ?? []).filter((e: any) => !q || [e.tms_lm_entregas?.destinatario, e.tms_lm_entregas?.cidade, e.tipo].filter(Boolean).some((s) => String(s).toLowerCase().includes(q.toLowerCase())));
    },
  });

  return (
    <TmsShell title="Last Mile" subtitle="Tracking">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por destinatário, cidade, evento…" className="w-full px-4 py-2.5 bg-surface ring-1 ring-border rounded-lg" />
      <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
        {(data ?? []).map((e: any) => (
          <div key={e.id} className="px-4 py-3 flex items-center gap-3 text-sm">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-foreground/10 font-bold">{e.tipo}</span>
            <span className="flex-1 truncate">{e.tms_lm_entregas?.destinatario ?? "—"} <span className="text-muted-foreground">· {e.tms_lm_entregas?.cidade ?? ""}</span></span>
            <span className="text-xs text-muted-foreground font-mono">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
          </div>
        ))}
        {!data?.length && <div className="px-4 py-10 text-center text-muted-foreground">Nenhum evento</div>}
      </div>
    </TmsShell>
  );
}
