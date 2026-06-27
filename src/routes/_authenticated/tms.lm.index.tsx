import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { KpiCard } from "@/components/tms/lm/kpi-card";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Package, MapPin, AlertTriangle, CheckCircle2, Clock, TrendingUp, CircleDollarSign, Users, Activity, PackageCheck, PackageOpen, Timer, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/")({
  head: () => ({ meta: [{ title: "Last Mile — Dashboard" }] }),
  component: LmDashboard,
});

function LmDashboard() {
  const { data } = useQuery({
    queryKey: ["lm-dashboard"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [{ data: rotas }, { data: entregas }, { data: ocor }] = await Promise.all([
        supabase.from("tms_lm_rotas").select("id, status, valor_rota, hora_prevista, hora_finalizada, motorista_id").gte("data", today.toISOString().slice(0, 10)),
        supabase.from("tms_lm_entregas").select("id, status, qtd_volumes, janela_fim, valor_mercadoria").limit(2000),
        supabase.from("tms_lm_ocorrencias").select("id").gte("created_at", today.toISOString()),
      ]);
      return { rotas: rotas ?? [], entregas: entregas ?? [], ocor: ocor ?? [] };
    },
  });
  const r = data?.rotas ?? [], e = data?.entregas ?? [], o = data?.ocor ?? [];
  const motoristasAtivos = new Set(r.filter(x => x.status === "em_rota").map(x => x.motorista_id)).size;
  const vols = (st: string[]) => e.filter(x => st.includes(x.status)).reduce((a, b) => a + (b.qtd_volumes || 0), 0);
  const entregues = e.filter(x => x.status === "entregue").length;
  const atrasadas = e.filter(x => x.janela_fim && new Date(x.janela_fim) < new Date() && x.status !== "entregue").length;
  const otif = e.length ? Math.round((entregues / e.length) * 100) : 0;
  const receitaPrev = r.reduce((a, b) => a + Number(b.valor_rota || 0), 0);
  const receitaEntr = r.filter(x => x.status === "finalizada").reduce((a, b) => a + Number(b.valor_rota || 0), 0);

  return (
    <TmsShell title="Last Mile" subtitle="Painel Operacional">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon={Package} label="Entregas Hoje" value={e.length} accent="#22c55e" />
        <KpiCard icon={MapPin} label="Rotas Ativas" value={r.filter(x => x.status === "em_rota").length} accent="#3b82f6" />
        <KpiCard icon={CheckCircle2} label="Rotas Finalizadas" value={r.filter(x => x.status === "finalizada").length} accent="#9ca3af" />
        <KpiCard icon={Users} label="Motoristas em Rota" value={motoristasAtivos} accent="#a855f7" />
        <KpiCard icon={PackageCheck} label="Volumes Separados" value={vols(["separado", "carregado", "saiu_entrega", "entregue"])} accent="#eab308" />
        <KpiCard icon={Truck} label="Volumes Carregados" value={vols(["carregado", "saiu_entrega", "entregue"])} accent="#f97316" />
        <KpiCard icon={PackageOpen} label="Volumes Pendentes" value={vols(["aguardando_separacao"])} accent="#6b7280" />
        <KpiCard icon={CheckCircle2} label="Entregas Concluídas" value={entregues} accent="#16a34a" />
        <KpiCard icon={AlertTriangle} label="Entregas Atrasadas" value={atrasadas} accent="#ef4444" />
        <KpiCard icon={Activity} label="Ocorrências" value={o.length} accent="#a855f7" />
        <KpiCard icon={Star} label="OTIF" value={`${otif}%`} accent="#22c55e" />
        <KpiCard icon={Timer} label="Produtividade" value={r.length ? `${Math.round(entregues / r.length)}/rota` : "—"} accent="#3b82f6" />
        <KpiCard icon={TrendingUp} label="Receita Prevista" value={`R$ ${receitaPrev.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} accent="#eab308" />
        <KpiCard icon={CircleDollarSign} label="Receita Entregue" value={`R$ ${receitaEntr.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} accent="#16a34a" />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface p-6 mt-6 min-h-[300px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="size-12 mx-auto mb-3 opacity-40" />
          <div className="font-semibold">Mapa em tempo real</div>
          <div className="text-xs mt-1">Integração com provider de mapas (Mapbox/Google) sob demanda</div>
        </div>
      </div>
    </TmsShell>
  );
}
