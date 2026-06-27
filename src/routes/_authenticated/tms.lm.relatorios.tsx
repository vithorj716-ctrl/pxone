import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/tms/lm/kpi-card";
import { Timer, Star, Truck, Package, TrendingUp, AlertTriangle, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/relatorios")({
  head: () => ({ meta: [{ title: "Last Mile — Relatórios" }] }),
  component: LmRel,
});

function LmRel() {
  const { data } = useQuery({
    queryKey: ["lm-rel"],
    queryFn: async () => {
      const [{ data: r }, { data: e }, { data: o }, { data: m }] = await Promise.all([
        supabase.from("tms_lm_rotas").select("id, valor_rota, motorista_id, status, hora_finalizada, hora_saida").limit(2000),
        supabase.from("tms_lm_entregas").select("status, cidade, cliente_id, rota_id, concluida_em, created_at, peso, valor_mercadoria").limit(5000),
        supabase.from("tms_lm_ocorrencias").select("tipo").limit(2000),
        supabase.from("tms_lm_motoristas").select("id, nome"),
      ]);
      return { r: r ?? [], e: e ?? [], o: o ?? [], m: m ?? [] };
    },
  });
  if (!data) return <TmsShell title="Last Mile" subtitle="Relatórios"><div className="text-muted-foreground">Carregando…</div></TmsShell>;

  const entregues = data.e.filter(x => x.status === "entregue");
  const otif = data.e.length ? Math.round((entregues.length / data.e.length) * 100) : 0;
  const tempos = entregues.filter(x => x.concluida_em && x.created_at).map(x => (new Date(x.concluida_em!).getTime() - new Date(x.created_at!).getTime()) / 60000);
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const taxaPrimeira = data.e.length ? Math.round((data.e.filter(x => x.status === "entregue").length / data.e.length) * 100) : 0;
  const peso = data.e.reduce((a, b) => a + Number(b.peso || 0), 0);

  const motMap = new Map(data.m.map((m: any) => [m.id, m.nome]));
  const rotasPorMot = new Map<string, number>();
  for (const r of data.r) {
    const k = motMap.get(r.motorista_id) ?? "—";
    rotasPorMot.set(k, (rotasPorMot.get(k) ?? 0) + 1);
  }
  const rankingMot = [...rotasPorMot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const porCidade = new Map<string, number>();
  for (const e of data.e) porCidade.set(e.cidade ?? "—", (porCidade.get(e.cidade ?? "—") ?? 0) + 1);
  const rankCidade = [...porCidade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <TmsShell title="Last Mile" subtitle="Dashboard Executivo">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Star} label="OTIF" value={`${otif}%`} accent="#22c55e" />
        <KpiCard icon={Timer} label="Tempo Médio" value={`${tempoMedio}min`} accent="#3b82f6" />
        <KpiCard icon={Package} label="Taxa 1ª Entrega" value={`${taxaPrimeira}%`} accent="#16a34a" />
        <KpiCard icon={TrendingUp} label="Peso Transportado" value={`${peso.toFixed(0)}kg`} accent="#f97316" />
        <KpiCard icon={Truck} label="Rotas" value={data.r.length} accent="#a855f7" />
        <KpiCard icon={Users} label="Motoristas" value={data.m.length} accent="#3b82f6" />
        <KpiCard icon={AlertTriangle} label="Ocorrências" value={data.o.length} accent="#ef4444" />
        <KpiCard icon={MapPin} label="Cidades" value={porCidade.size} accent="#eab308" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl ring-1 ring-border bg-surface p-4">
          <h3 className="font-bold mb-3">Ranking de Motoristas</h3>
          <div className="space-y-1.5 text-sm">
            {rankingMot.map(([nome, n], i) => (
              <div key={nome} className="flex items-center gap-2">
                <span className="text-[10px] w-5 text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{nome}</span>
                <span className="font-mono font-bold">{n} rotas</span>
              </div>
            ))}
            {!rankingMot.length && <div className="text-muted-foreground text-xs">Sem dados</div>}
          </div>
        </div>
        <div className="rounded-xl ring-1 ring-border bg-surface p-4">
          <h3 className="font-bold mb-3">Entregas por Cidade</h3>
          <div className="space-y-1.5 text-sm">
            {rankCidade.map(([cid, n], i) => (
              <div key={cid} className="flex items-center gap-2">
                <span className="text-[10px] w-5 text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{cid}</span>
                <span className="font-mono font-bold">{n}</span>
              </div>
            ))}
            {!rankCidade.length && <div className="text-muted-foreground text-xs">Sem dados</div>}
          </div>
        </div>
      </div>
    </TmsShell>
  );
}
