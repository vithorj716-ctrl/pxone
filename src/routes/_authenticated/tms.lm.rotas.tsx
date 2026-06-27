import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { RotaCard, type RotaCardData } from "@/components/tms/lm/rota-card";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/tms/lm/rotas")({
  head: () => ({ meta: [{ title: "Last Mile — Rotas" }] }),
  component: LmRotas,
});

function LmRotas() {
  const [status, setStatus] = useState<string>("todas");
  const { data } = useQuery({
    queryKey: ["lm-rotas"],
    queryFn: async () => {
      const { data: rotas } = await supabase.from("tms_lm_rotas").select("*, tms_lm_motoristas(nome), tms_lm_veiculos(placa, modelo)").order("data", { ascending: false }).limit(200);
      const ids = (rotas ?? []).map(r => r.id);
      const { data: entregas } = ids.length ? await supabase.from("tms_lm_entregas").select("rota_id, status, qtd_volumes, peso, cubagem").in("rota_id", ids) : { data: [] };
      return { rotas: rotas ?? [], entregas: entregas ?? [] };
    },
  });

  const cards: RotaCardData[] = useMemo(() => {
    if (!data) return [];
    return data.rotas.map((r: any) => {
      const es = data.entregas.filter((e: any) => e.rota_id === r.id);
      return {
        id: r.id, numero: r.numero,
        motorista: r.tms_lm_motoristas?.nome,
        veiculo: r.tms_lm_veiculos ? `${r.tms_lm_veiculos.placa} ${r.tms_lm_veiculos.modelo ?? ""}` : null,
        cidade: r.cidade,
        qtdEntregas: es.length,
        qtdVolumes: es.reduce((a: number, b: any) => a + (b.qtd_volumes || 0), 0),
        peso: es.reduce((a: number, b: any) => a + Number(b.peso || 0), 0),
        cubagem: es.reduce((a: number, b: any) => a + Number(b.cubagem || 0), 0),
        horaSaida: r.hora_saida, horaPrevista: r.hora_prevista,
        status: r.status, valorRota: Number(r.valor_rota || 0),
        entregas: es,
      };
    });
  }, [data]);

  const filtradas = status === "todas" ? cards : cards.filter(c => c.status === status);

  const STATUSES = ["todas", "planejada", "separando", "carregando", "em_rota", "finalizada", "atrasada", "ocorrencia"];

  return (
    <TmsShell
      title="Last Mile" subtitle="Rotas"
      headerActions={
        <Link to="/tms/lm/configuracoes" className="text-xs px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white inline-flex items-center gap-1.5">
          <Plus className="size-3.5" /> Nova Rota
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md ${status === s ? "bg-foreground text-background" : "bg-surface ring-1 ring-border text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filtradas.map(r => <RotaCard key={r.id} r={r} />)}
        {!filtradas.length && <div className="col-span-full text-center text-muted-foreground py-16">Nenhuma rota encontrada</div>}
      </div>
    </TmsShell>
  );
}
