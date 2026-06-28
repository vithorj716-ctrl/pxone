import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/viagens")({
  head: () => ({ meta: [{ title: "PXLog — Viagens" }] }),
  component: ViagensPage,
});

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  planejada: { label: "Planejada", cor: "bg-slate-500/15 text-slate-300" },
  em_embarque: { label: "Em embarque", cor: "bg-amber-500/15 text-amber-300" },
  em_transito: { label: "Em trânsito", cor: "bg-indigo-500/15 text-indigo-300" },
  finalizada: { label: "Finalizada", cor: "bg-emerald-500/15 text-emerald-300" },
  cancelada: { label: "Cancelada", cor: "bg-rose-500/15 text-rose-300" },
};

function ViagensPage() {
  const [viagens, setViagens] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tms_viagens").select("*").order("created_at", { ascending: false }).limit(200);
      setViagens(data ?? []);
    })();
  }, []);

  const filtradas = viagens.filter((v) => !filtro || v.status === filtro);

  return (
    <TmsShell title="Viagens" subtitle="Operação de embarque e transferência">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {["", ...Object.keys(STATUS_LABEL)].map((s) => (
            <button key={s||"all"} onClick={() => setFiltro(s)}
              className={`px-2.5 py-1 text-[10px] uppercase rounded ${filtro===s ? "bg-brand text-brand-foreground" : "ring-1 ring-border text-muted-foreground"}`}>
              {s ? STATUS_LABEL[s].label : "Todas"}
            </button>
          ))}
        </div>
        <Link to="/tms/embarque" className="px-3 py-1.5 text-xs rounded-md bg-brand text-brand-foreground inline-flex items-center gap-1.5">
          <Truck className="size-3.5" /> Nova viagem
        </Link>
      </div>
      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground bg-background/40">
            <tr>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Rota</th>
              <th className="text-left p-2">Motorista</th>
              <th className="text-left p-2">Placa</th>
              <th className="text-right p-2">Embarcados</th>
              <th className="text-right p-2">Tempo</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Iniciada</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma viagem.</td></tr>}
            {filtradas.map((v) => {
              const st = STATUS_LABEL[v.status];
              return (
                <tr key={v.id} className="border-t border-border/40 hover:bg-white/5">
                  <td className="p-2">
                    <Link to="/tms/viagens/$codigo" params={{ codigo: v.codigo }} className="font-mono text-brand">{v.codigo}</Link>
                  </td>
                  <td className="p-2">{v.origem} → {v.destino}</td>
                  <td className="p-2">{v.motorista_nome ?? "—"}</td>
                  <td className="p-2 font-mono">{v.placa ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{v.qtd_volumes_emb}/{v.qtd_volumes_prev}</td>
                  <td className="p-2 text-right tabular-nums">{v.tempo_operacao_min ? `${v.tempo_operacao_min} min` : "—"}</td>
                  <td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] ${st?.cor || "bg-muted"}`}>{st?.label ?? v.status}</span></td>
                  <td className="p-2 text-muted-foreground">{v.iniciada_em ? new Date(v.iniciada_em).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TmsShell>
  );
}
