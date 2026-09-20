import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listAtividades, concluirAtividade, type AtividadeRow } from "@/lib/pxsales-pipeline.functions";

export const Route = createFileRoute("/_authenticated/sales/agenda")({
  head: () => ({
    meta: [
      { title: "PXSales — Agenda comercial | Grupo PX" },
      { name: "description", content: "Compromissos, visitas e tarefas do time comercial organizados por dia." },
      { property: "og:title", content: "PXSales — Agenda comercial" },
      { property: "og:description", content: "Compromissos e tarefas do time comercial por dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

const hora = (v?: string | null) => (v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
const diaLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

function AgendaPage() {
  const list = useServerFn(listAtividades);
  const concluir = useServerFn(concluirAtividade);
  const qc = useQueryClient();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["pxsales", "agenda"],
    queryFn: () => list({ data: { filtro: "todos" } }),
  });

  const dias = useMemo(() => {
    const map = new Map<string, AtividadeRow[]>();
    for (const a of atividades) {
      if (a.concluida) continue;
      const k = a.prevista_para ? String(a.prevista_para).slice(0, 10) : "sem-data";
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [atividades]);

  const hoje = new Date().toISOString().slice(0, 10);

  async function marcar(id: string) {
    try {
      await concluir({ data: { id } });
      toast.success("Compromisso concluído.");
      qc.invalidateQueries({ queryKey: ["pxsales"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível concluir.");
    }
  }

  return (
    <PxSalesShell title="Agenda" subtitle="Compromissos do time">
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando agenda…</p>
        ) : dias.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <CalendarDays className="size-6 mx-auto mb-2 opacity-60" />
            Nenhum compromisso em aberto. Crie follow-ups nos leads e oportunidades para vê-los aqui.
          </div>
        ) : (
          dias.map(([dia, itens]) => (
            <section key={dia} className="rounded-xl border p-4">
              <h2 className={`text-sm font-medium capitalize ${dia !== "sem-data" && dia < hoje ? "text-red-600" : ""}`}>
                {dia === "sem-data" ? "Sem data definida" : diaLabel(dia)}
                {dia === hoje ? " · hoje" : ""}
              </h2>
              <ul className="mt-3 space-y-2">
                {itens.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="text-xs tabular-nums text-muted-foreground w-12 shrink-0">{hora(a.prevista_para)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.assunto}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.tipo}
                        {a.referencia ? ` · ${a.referencia}` : ""}
                        {a.responsavel_nome ? ` · ${a.responsavel_nome}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => marcar(a.id)}>
                      <CheckCircle2 className="size-4 mr-1.5" /> Concluir
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PxSalesShell>
  );
}
