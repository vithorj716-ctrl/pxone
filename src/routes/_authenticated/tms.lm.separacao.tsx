import { createFileRoute } from "@tanstack/react-router";
import { TmsShell } from "@/components/tms/tms-shell";
import { ScanInput } from "@/components/tms/scan-input";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/separacao")({
  head: () => ({ meta: [{ title: "Last Mile — Separação" }] }),
  component: LmSeparacao,
});

function LmSeparacao() {
  const [log, setLog] = useState<{ codigo: string; destinatario: string; rota: number; ok: boolean }[]>([]);

  async function bipar(codigo: string) {
    const { data: vol } = await supabase.from("tms_lm_volumes").select("*, tms_lm_entregas(destinatario, rota_id, tms_lm_rotas(numero))").eq("codigo", codigo).maybeSingle();
    if (!vol) { toast.error(`Volume ${codigo} não encontrado`); setLog((l) => [{ codigo, destinatario: "—", rota: 0, ok: false }, ...l]); return; }
    await supabase.from("tms_lm_volumes").update({ status: "separado", separado_em: new Date().toISOString() }).eq("id", vol.id);
    await supabase.from("tms_lm_eventos").insert({ entrega_id: vol.entrega_id, tipo: "separado", payload: { codigo } });
    const e: any = vol.tms_lm_entregas;
    setLog((l) => [{ codigo, destinatario: e?.destinatario ?? "—", rota: e?.tms_lm_rotas?.numero ?? 0, ok: true }, ...l]);
    toast.success(`Separado: ${e?.destinatario}`);
  }

  return (
    <TmsShell title="Last Mile" subtitle="Separação · bipar etiqueta">
      <ScanInput onScan={bipar} placeholder="Bipe o código do volume…" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Bipados</div><div className="text-2xl font-bold">{log.length}</div></div>
        <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Sucesso</div><div className="text-2xl font-bold text-green-500">{log.filter(l => l.ok).length}</div></div>
        <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Falhas</div><div className="text-2xl font-bold text-red-500">{log.filter(l => !l.ok).length}</div></div>
      </div>
      <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border mt-4">
        {log.slice(0, 20).map((l, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
            {l.ok ? <CheckCircle2 className="size-5 text-green-500" /> : <Package className="size-5 text-red-500" />}
            <span className="font-mono">{l.codigo}</span>
            <span className="text-muted-foreground">→</span>
            <span className="flex-1 truncate">{l.destinatario}</span>
            {l.rota > 0 && <span className="text-xs text-muted-foreground">Rota #{l.rota}</span>}
          </div>
        ))}
        {!log.length && <div className="px-4 py-12 text-center text-muted-foreground text-sm">Aguardando leitura…</div>}
      </div>
    </TmsShell>
  );
}
