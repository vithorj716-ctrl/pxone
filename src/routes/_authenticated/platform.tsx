import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { PX_MODULES } from "@/px-core/registry";
import { getPlatformOverview } from "@/px-core/api/dashboard.functions";
import { Boxes, Activity, Brain, Database, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({ meta: [{ title: "PX Platform — Dashboard Global" }] }),
  component: PlatformPage,
});

function statusColor(s: string) {
  switch (s) {
    case "ativo": return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
    case "beta": return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
    case "planejado": return "bg-sky-500/15 text-sky-400 ring-sky-500/30";
    default: return "bg-muted text-muted-foreground ring-border";
  }
}

function PlatformPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
  });

  const ativos = PX_MODULES.filter((m) => m.status === "ativo").length;
  const planejados = PX_MODULES.filter((m) => m.status === "planejado").length;

  return (
    <AppShell title="PX Platform" subtitle="Núcleo de arquitetura e governança do ecossistema PX">
      <div className="space-y-6">
        {/* KPIs topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={<Boxes className="size-4" />} label="Módulos ativos" value={String(ativos)} hint={`${planejados} planejados`} />
          <Card icon={<Activity className="size-4" />} label="Eventos (últimos)" value={String(data?.eventos_total ?? 0)} hint="px_events" />
          <Card icon={<Brain className="size-4" />} label="Chamadas IA" value={String(data?.ia.chamadas_ultimas ?? 0)} hint={`${data?.ia.tokens_total ?? 0} tokens`} />
          <Card icon={<Database className="size-4" />} label="Registros Core" value={String((data?.contadores.custos ?? 0) + (data?.contadores.empresas ?? 0) + (data?.contadores.kpis ?? 0))} hint={`${data?.contadores.documentos ?? 0} docs`} />
        </div>

        {/* Saúde */}
        <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-emerald-400" />
          <div>
            <div className="text-sm font-medium">Sistema saudável</div>
            <div className="text-xs text-muted-foreground">PX Core, Event Bus, API Layer e AI Core operacionais.</div>
          </div>
        </div>

        {/* Module Registry */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Module Registry</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PX_MODULES.map((m) => (
              <div key={m.key} className="rounded-xl ring-1 ring-border bg-surface/40 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">v{m.versao}</div>
                  </div>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded ring-1 ${statusColor(m.status)}`}>{m.status}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.descricao}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {m.eventos.slice(0, 3).map((e) => (
                    <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono">{e}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Eventos recentes */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Eventos recentes</h2>
          <div className="rounded-xl ring-1 ring-border bg-surface/40 overflow-hidden">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
            ) : (data?.eventos_recentes ?? []).length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="size-4" /> Nenhum evento registrado ainda. Módulos futuros publicarão aqui.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.eventos_recentes.map((ev: any) => (
                  <li key={ev.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-emerald-400 truncate">{ev.tipo}</span>
                      <span className="text-xs text-muted-foreground truncate">{ev.origem ?? "—"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* IA por módulo */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Uso da IA por módulo</h2>
          <div className="rounded-xl ring-1 ring-border bg-surface/40 p-4">
            {(data?.ia.por_modulo ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem chamadas registradas ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data!.ia.por_modulo.map((r: any) => (
                  <li key={r.modulo} className="flex justify-between">
                    <span>{r.modulo}</span>
                    <span className="font-mono text-muted-foreground">{r.chamadas}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Card({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
