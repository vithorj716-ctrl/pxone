import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { QrSvg } from "@/components/tms/qr-label";
import { Timeline } from "@/components/tms/timeline";
import { STATUS_VOL_LABEL } from "@/lib/tms";
import { Printer, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/minutas/$numero")({
  head: () => ({ meta: [{ title: "PXLog — Minuta" }] }),
  component: MinutaPage,
});

function MinutaPage() {
  const { numero } = useParams({ from: "/_authenticated/tms/minutas/$numero" });
  const [minuta, setMinuta] = useState<any | null>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("tms_minutas")
        .select("*, tms_clientes(nome, cnpj)")
        .eq("numero", Number(numero))
        .maybeSingle();
      if (!m) return;
      setMinuta(m as any);
      const [v, e] = await Promise.all([
        supabase.from("tms_volumes").select("*").eq("minuta_id", (m as any).id).order("numero"),
        supabase.from("tms_eventos").select("*").eq("minuta_id", (m as any).id).order("created_at"),
      ]);
      setVolumes((v.data ?? []) as any[]);
      setEventos((e.data ?? []) as any[]);
    })();
  }, [numero]);

  if (!minuta) return <TmsShell title="Carregando…"><div className="text-sm text-muted-foreground">Buscando minuta #{numero}…</div></TmsShell>;

  const st = STATUS_VOL_LABEL[minuta.status];

  return (
    <AppShell
      title={`Minuta #${minuta.numero}`}
      subtitle={`${minuta.origem} → ${minuta.destino}`}
      headerActions={
        <div className="flex items-center gap-1">
          <Link to="/tms/etiquetas/$minuta" params={{ minuta: String(minuta.numero) }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs ring-1 ring-border bg-surface/60 hover:bg-surface">
            <Tag className="size-3.5" /> Etiquetas
          </Link>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-brand text-brand-foreground">
            <Printer className="size-3.5" /> Imprimir
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 flex items-start justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="text-[10px] uppercase text-muted-foreground">Cliente</div>
              <div className="text-sm font-semibold">{minuta.tms_clientes?.nome ?? "—"}</div>
              <div className="text-muted-foreground">{minuta.tms_clientes?.cnpj ?? ""}</div>
              <div className="pt-2 grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Remetente:</span> {minuta.remetente?.nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Destinatário:</span> {minuta.destinatario?.nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Volumes:</span> {minuta.qtd_volumes}</div>
                <div><span className="text-muted-foreground">Peso taxado:</span> {Number(minuta.peso_taxado).toFixed(2)} kg</div>
                <div><span className="text-muted-foreground">Cubagem:</span> {Number(minuta.cubagem).toFixed(3)} m³</div>
                <div><span className="text-muted-foreground">Prazo:</span> {minuta.prazo_dias} dia(s)</div>
                <div><span className="text-muted-foreground">Mercadoria:</span> {minuta.tipo_mercadoria ?? "—"}</div>
                <div><span className="text-muted-foreground">Valor frete:</span> <span className="font-semibold text-brand">{Number(minuta.valor_frete).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
              </div>
            </div>
            <div className="text-center shrink-0">
              <QrSvg value={`MINUTA-${minuta.numero}`} size={120} />
              <div className="mt-1 text-[10px] font-mono text-muted-foreground">#{minuta.numero}</div>
              <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded ${st?.cor || "bg-muted"}`}>{st?.label || minuta.status}</span>
            </div>
          </div>

          <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
            <h3 className="text-sm font-semibold mb-3">Volumes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Código</th>
                    <th className="text-right p-2">Peso</th>
                    <th className="text-left p-2">HUB</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((v) => {
                    const vs = STATUS_VOL_LABEL[v.status];
                    return (
                      <tr key={v.id} className="border-b border-border/40">
                        <td className="p-2">{v.numero}/{minuta.qtd_volumes}</td>
                        <td className="p-2 font-mono text-[10px]">{v.codigo}</td>
                        <td className="p-2 text-right tabular-nums">{Number(v.peso).toFixed(2)} kg</td>
                        <td className="p-2 text-muted-foreground">{v.hub_atual ?? "—"}</td>
                        <td className="p-2"><span className={`text-[10px] px-2 py-0.5 rounded ${vs?.cor || "bg-muted"}`}>{vs?.label || v.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold mb-3">Tracking</h3>
          <Timeline eventos={eventos} />
        </aside>
      </div>
    </TmsShell>
  );
}
