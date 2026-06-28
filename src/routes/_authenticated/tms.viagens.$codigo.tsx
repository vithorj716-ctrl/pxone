import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Clock, Package, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/viagens/$codigo")({
  head: () => ({ meta: [{ title: "PXLog — Resumo da viagem" }] }),
  component: ViagemDetalhe,
});

function ViagemDetalhe() {
  const { codigo } = useParams({ from: "/_authenticated/tms/viagens/$codigo" });
  const [v, setV] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [minutas, setMinutas] = useState<any[]>([]);
  const [pendentes, setPendentes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: viagem } = await supabase.from("tms_viagens").select("*").eq("codigo", codigo).maybeSingle();
      if (!viagem) return;
      setV(viagem);
      const [{ data: evs }, { data: links }] = await Promise.all([
        supabase.from("tms_viagem_eventos").select("*").eq("viagem_id", (viagem as any).id).order("created_at"),
        supabase.from("tms_viagem_minutas").select("minuta_id, tms_minutas(id, numero, destino, qtd_volumes, tms_clientes(nome))").eq("viagem_id", (viagem as any).id),
      ]);
      setEventos(evs ?? []);
      const ms = (links ?? []).map((l: any) => l.tms_minutas).filter(Boolean);
      setMinutas(ms);
      const ids = ms.map((m: any) => m.id);
      if (ids.length) {
        const { data: vols } = await supabase.from("tms_volumes").select("id, codigo, numero, status").in("minuta_id", ids).neq("status", "embarcado").neq("status", "cancelado");
        setPendentes(vols ?? []);
      }
    })();
  }, [codigo]);

  if (!v) return <TmsShell title="Carregando…"><div className="text-sm text-muted-foreground">Buscando viagem {codigo}…</div></TmsShell>;

  const resumo = v.resumo ?? {
    previstos: v.qtd_volumes_prev, embarcados: v.qtd_volumes_emb,
    faltantes: Math.max(0, v.qtd_volumes_prev - v.qtd_volumes_emb),
    peso_prev: v.peso_prev, peso_emb: v.peso_emb, tempo_min: v.tempo_operacao_min,
  };
  const pct = resumo.previstos > 0 ? Math.round((resumo.embarcados / resumo.previstos) * 100) : 0;

  return (
    <TmsShell title={`Viagem ${v.codigo}`} subtitle={`${v.origem} → ${v.destino}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Card icon={<Truck className="size-3.5" />} label="Motorista" value={v.motorista_nome ?? "—"} />
            <Card label="Placa" value={v.placa ?? "—"} />
            <Card label="Rota" value={v.rota ?? "—"} />
            <Card icon={<Clock className="size-3.5" />} label="Tempo" value={resumo.tempo_min ? `${resumo.tempo_min} min` : "—"} />
            <Card label="Previstos" value={resumo.previstos} />
            <Card label="Embarcados" value={resumo.embarcados} highlight />
            <Card label="Faltantes" value={resumo.faltantes} alert={resumo.faltantes > 0} />
            <Card label="% conferido" value={`${pct}%`} />
            <Card label="Peso previsto" value={`${Number(resumo.peso_prev).toFixed(1)} kg`} />
            <Card label="Peso embarcado" value={`${Number(resumo.peso_emb).toFixed(1)} kg`} />
            <Card label="Status" value={v.status} />
            <Card label="Iniciada" value={v.iniciada_em ? new Date(v.iniciada_em).toLocaleString("pt-BR") : "—"} />
          </div>

          {pendentes.length > 0 && (
            <div className="rounded-xl ring-1 ring-rose-500/40 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-300 mb-2">
                <AlertTriangle className="size-4" /> {pendentes.length} volumes ficaram pendentes
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">
                {pendentes.map((p) => (
                  <div key={p.id} className="font-mono text-[10px] px-2 py-1 rounded bg-background ring-1 ring-rose-500/30">{p.codigo}</div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
            <h3 className="text-sm font-semibold mb-2">Minutas ({minutas.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {minutas.map((m) => (
                <Link key={m.id} to="/tms/minutas/$numero" params={{ numero: String(m.numero) }}
                  className="text-xs px-2 py-1 rounded ring-1 ring-border bg-background hover:bg-brand/10">
                  #{m.numero} · {m.tms_clientes?.nome ?? "—"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold mb-3">Linha do tempo</h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto thin-scroll">
            {eventos.length === 0 && <div className="text-xs text-muted-foreground">Sem eventos.</div>}
            {eventos.map((e) => (
              <div key={e.id} className="flex gap-2 text-xs">
                {e.tipo === "bip_ok" ? <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  : e.tipo === "bip_erro" ? <AlertTriangle className="size-3.5 text-rose-400 shrink-0 mt-0.5" />
                  : <Package className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")} · {e.tipo}</div>
                  <div className="truncate">{e.codigo ?? ""} {e.motivo ? `· ${e.motivo}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </TmsShell>
  );
}

function Card({ label, value, icon, highlight, alert }: { label: string; value: any; icon?: React.ReactNode; highlight?: boolean; alert?: boolean }) {
  return (
    <div className="rounded-md bg-background/60 ring-1 ring-border p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className={`text-sm font-semibold mt-0.5 truncate ${highlight ? "text-brand" : ""} ${alert ? "text-rose-300" : ""}`}>{value}</div>
    </div>
  );
}
