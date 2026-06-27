import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Timeline } from "@/components/tms/timeline";
import { Truck, Package, CheckCircle2, AlertTriangle, CircleDollarSign, Users, ScanLine, Tag, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/")({
  head: () => ({ meta: [{ title: "PXLog — Dashboard" }] }),
  component: TmsDashboard,
});

function brl(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function startOfDay() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }

function TmsDashboard() {
  const [minutas, setMinutas] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = startOfDay();
      const [m, e, v] = await Promise.all([
        supabase.from("tms_minutas").select("id, numero, status, status_financeiro, valor_frete, cliente_id, qtd_volumes, created_at, tms_clientes(nome)").order("created_at", { ascending: false }).limit(200),
        supabase.from("tms_eventos").select("id, tipo, created_at, origem_evento, minuta_id, volume_id").gte("created_at", today).order("created_at", { ascending: false }).limit(50),
        supabase.from("tms_volumes").select("id, status, minuta_id"),
      ]);
      setMinutas((m.data ?? []) as any[]);
      setEventos((e.data ?? []) as any[]);
      setVolumes((v.data ?? []) as any[]);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const minutasHoje = minutas.filter((m) => new Date(m.created_at) >= today);
    const faturamentoHoje = minutasHoje.reduce((a, b) => a + Number(b.valor_frete || 0), 0);
    const previsto = minutas.filter((m) => m.status_financeiro === "previsto").reduce((a, b) => a + Number(b.valor_frete || 0), 0);
    const byStatus = (s: string) => volumes.filter((v) => v.status === s).length;
    return {
      coletasHoje: eventos.filter((e) => e.tipo === "coletado").length,
      entreguesHoje: eventos.filter((e) => e.tipo === "entregue").length,
      aguardandoColeta: byStatus("solicitado") + byStatus("coleta_programada"),
      aguardandoEmbarque: byStatus("conferido") + byStatus("etiquetado") + byStatus("recebido_hub_origem"),
      emTransito: byStatus("embarcado") + byStatus("em_transferencia"),
      aguardandoEntrega: byStatus("recebido_hub_destino") + byStatus("separado") + byStatus("em_rota") + byStatus("saiu_entrega"),
      entreguesTotal: byStatus("entregue"),
      ocorrencias: byStatus("ocorrencia"),
      faturamentoHoje,
      previsto,
      qtdMinutas: minutas.length,
      qtdMinutasHoje: minutasHoje.length,
    };
  }, [minutas, eventos, volumes]);

  const ranking = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; minutas: number }>();
    for (const m of minutas) {
      const key = m.tms_clientes?.nome ?? "—";
      const cur = map.get(key) ?? { nome: key, total: 0, minutas: 0 };
      cur.total += Number(m.valor_frete || 0);
      cur.minutas += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [minutas]);

  return (
    <TmsShell
      title="Dashboard PXLog"
      subtitle="Operação em tempo real · Transfer Hub"
      headerActions={
        <Link to="/tms/solicitacoes/nova" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-brand text-brand-foreground">
          <Plus className="size-3.5" /> Nova minuta
        </Link>
      }
    >
      {loading ? <div className="text-xs text-muted-foreground">Carregando operação…</div> : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi icon={<Truck className="size-4" />} label="Coletas hoje" value={String(kpis.coletasHoje)} tone="amber" />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Entregues hoje" value={String(kpis.entreguesHoje)} tone="emerald" />
        <Kpi icon={<Package className="size-4" />} label="Aguardando coleta" value={String(kpis.aguardandoColeta)} />
        <Kpi icon={<Package className="size-4" />} label="Aguardando embarque" value={String(kpis.aguardandoEmbarque)} />
        <Kpi icon={<Truck className="size-4" />} label="Em trânsito" value={String(kpis.emTransito)} tone="indigo" />
        <Kpi icon={<Package className="size-4" />} label="Aguardando entrega" value={String(kpis.aguardandoEntrega)} tone="cyan" />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Entregues (total)" value={String(kpis.entreguesTotal)} tone="emerald" />
        <Kpi icon={<AlertTriangle className="size-4" />} label="Ocorrências" value={String(kpis.ocorrencias)} tone={kpis.ocorrencias > 0 ? "rose" : undefined} />
        <Kpi icon={<CircleDollarSign className="size-4" />} label="Faturamento hoje" value={brl(kpis.faturamentoHoje)} tone="brand" />
        <Kpi icon={<CircleDollarSign className="size-4" />} label="Previsto a faturar" value={brl(kpis.previsto)} />
        <Kpi icon={<Users className="size-4" />} label="Minutas hoje" value={String(kpis.qtdMinutasHoje)} />
        <Kpi icon={<Users className="size-4" />} label="Minutas (total)" value={String(kpis.qtdMinutas)} />
      </div>

      {/* Atalhos operacionais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Atalho to="/tms/conferencia" icon={<ScanLine className="size-4" />} label="Conferência" />
        <Atalho to="/tms/embarque" icon={<Truck className="size-4" />} label="Embarque" />
        <Atalho to="/tms/recebimento" icon={<Package className="size-4" />} label="Recebimento" />
        <Atalho to="/tms/entregas" icon={<CheckCircle2 className="size-4" />} label="Entregas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold mb-3">Ranking de clientes</h3>
          {ranking.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Sem dados ainda.</div>
          ) : (
            <div className="space-y-2">
              {ranking.map((r, idx) => {
                const max = ranking[0]?.total || 1;
                const pct = (r.total / max) * 100;
                return (
                  <div key={r.nome} className="flex items-center gap-3 text-xs">
                    <div className="w-5 text-center text-muted-foreground font-mono">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{r.nome}</span>
                        <span className="text-muted-foreground tabular-nums">{brl(r.total)}</span>
                      </div>
                      <div className="h-1.5 mt-1 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.minutas} minuta(s)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Tag className="size-4 text-brand" /> Eventos de hoje</h3>
          <Timeline eventos={eventos.slice(0, 12)} />
        </div>
      </div>
    </TmsShell>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "brand" | "emerald" | "rose" | "amber" | "indigo" | "cyan" }) {
  const color =
    tone === "emerald" ? "text-emerald-400"
    : tone === "rose" ? "text-rose-400"
    : tone === "amber" ? "text-amber-400"
    : tone === "indigo" ? "text-indigo-400"
    : tone === "cyan" ? "text-cyan-400"
    : tone === "brand" ? "text-brand"
    : "text-foreground";
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Atalho({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="rounded-xl ring-1 ring-border bg-surface/60 hover:bg-surface-2 p-3 flex items-center gap-2 text-sm transition-colors">
      <div className="size-8 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">{icon}</div>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
