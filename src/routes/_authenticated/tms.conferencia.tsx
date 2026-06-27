import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { ScanInput } from "@/components/tms/scan-input";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_VOL_LABEL } from "@/lib/tms";
import { toast } from "sonner";

type Operacao = {
  evento: "conferido" | "embarcado" | "recebido_hub_destino" | "entregue" | "coletado";
  titulo: string;
  subtitulo: string;
  novoStatus: string;
  hubAtual?: string;
};

const OPERACOES: Record<string, Operacao> = {
  conferencia: { evento: "conferido", titulo: "Conferência", subtitulo: "Bipe os volumes para conferir", novoStatus: "conferido" },
  embarque: { evento: "embarcado", titulo: "Embarque", subtitulo: "Bipe para embarcar no veículo", novoStatus: "embarcado", hubAtual: "transito" },
  recebimento: { evento: "recebido_hub_destino", titulo: "Recebimento HUB Destino", subtitulo: "Bipe ao receber no HUB de destino", novoStatus: "recebido_hub_destino", hubAtual: "destino" },
  entrega: { evento: "entregue", titulo: "Entrega", subtitulo: "Bipe para baixar entrega", novoStatus: "entregue", hubAtual: "entregue" },
  coleta: { evento: "coletado", titulo: "Coleta", subtitulo: "Bipe ao coletar a mercadoria", novoStatus: "coletado", hubAtual: "origem" },
};

export function ScanOperationPage({ op, extraField }: { op: Operacao; extraField?: { label: string; key: string } }) {
  const [historico, setHistorico] = useState<{ codigo: string; ok: boolean; msg: string }[]>([]);
  const [extra, setExtra] = useState("");

  async function processar(codigo: string) {
    const { data: vol } = await supabase
      .from("tms_volumes")
      .select("id, numero, status, tms_minutas(numero, qtd_volumes, destino)")
      .eq("codigo", codigo)
      .maybeSingle() as any;

    if (!vol) {
      setHistorico((h) => [{ codigo, ok: false, msg: "Código não encontrado" }, ...h].slice(0, 50));
      toast.error("Código inválido");
      return;
    }

    const updates: any = { status: op.novoStatus };
    if (op.hubAtual) updates.hub_atual = op.hubAtual;
    await supabase.from("tms_volumes").update(updates).eq("id", vol.id);

    const payload: any = {};
    if (extraField && extra) payload[extraField.key] = extra;
    await supabase.from("tms_eventos").insert({
      minuta_id: (vol as any).tms_minutas ? undefined : undefined,
      volume_id: vol.id,
      tipo: op.evento,
      origem_evento: op.titulo,
      payload,
    });

    const m = (vol as any).tms_minutas;
    setHistorico((h) => [
      { codigo, ok: true, msg: `Minuta #${m?.numero} · Vol ${vol.numero}/${m?.qtd_volumes} → ${m?.destino}` },
      ...h,
    ].slice(0, 50));
  }

  const total = historico.filter((h) => h.ok).length;

  return (
    <TmsShell title={op.titulo} subtitle={op.subtitulo}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {extraField && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{extraField.label}</label>
              <input value={extra} onChange={(e) => setExtra(e.target.value)}
                className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-3 py-2 text-sm" />
            </div>
          )}
          <ScanInput onScan={processar} />
          <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Últimas leituras
            </div>
            <div className="max-h-[60vh] overflow-y-auto thin-scroll divide-y divide-border/40">
              {historico.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Pronto para bipar.</div>
              ) : historico.map((h, i) => (
                <div key={i} className={`px-3 py-2 text-xs flex items-start gap-2 ${h.ok ? "" : "bg-rose-500/5"}`}>
                  <span className={`size-1.5 rounded-full mt-1.5 ${h.ok ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-muted-foreground">{h.codigo}</div>
                    <div className={h.ok ? "" : "text-rose-300"}>{h.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4 self-start">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Processados na sessão</div>
          <div className="text-4xl font-bold text-brand mt-1 tabular-nums">{total}</div>
          <div className="mt-3 text-[10px] text-muted-foreground">Status final: <span className="font-medium">{STATUS_VOL_LABEL[op.novoStatus]?.label}</span></div>
        </aside>
      </div>
    </TmsShell>
  );
}

export const Route = createFileRoute("/_authenticated/tms/conferencia")({
  head: () => ({ meta: [{ title: "PXLog — Conferência" }] }),
  component: () => <ScanOperationPage op={OPERACOES.conferencia} />,
});

export { OPERACOES };
