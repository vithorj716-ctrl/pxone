import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { EntregaCard } from "@/components/tms/lm/entrega-card";
import { PodCapture } from "@/components/tms/lm/pod-capture";
import { supabase } from "@/integrations/supabase/client";
import { LM_STATUS_ROTA } from "@/lib/tms-lm";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/tms/lm/rotas/$numero")({
  head: () => ({ meta: [{ title: "Last Mile — Rota" }] }),
  component: LmRotaDetalhe,
});

function LmRotaDetalhe() {
  const { numero } = Route.useParams();
  const [podId, setPodId] = useState<string | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ["lm-rota", numero],
    queryFn: async () => {
      const { data: rota } = await supabase.from("tms_lm_rotas").select("*, tms_lm_motoristas(nome), tms_lm_veiculos(placa, modelo)").eq("numero", Number(numero)).maybeSingle();
      if (!rota) return null;
      const { data: entregas } = await supabase.from("tms_lm_entregas").select("*, tms_clientes(nome)").eq("rota_id", rota.id).order("ordem");
      return { rota, entregas: entregas ?? [] };
    },
  });

  if (!data) return <TmsShell title="Last Mile" subtitle="Rota"><div className="text-muted-foreground">Carregando…</div></TmsShell>;
  const { rota, entregas } = data;
  const meta = LM_STATUS_ROTA[rota.status as keyof typeof LM_STATUS_ROTA];

  return (
    <TmsShell title={`Rota #${rota.numero}`} subtitle={rota.cidade ?? ""}>
      <div className="rounded-xl ring-1 ring-border p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm" style={{ background: meta?.bg }}>
        <div><div className="text-[10px] uppercase text-muted-foreground">Status</div><div className="font-bold" style={{ color: meta?.color }}>{meta?.label}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Motorista</div><div>{rota.tms_lm_motoristas?.nome ?? "—"}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Veículo</div><div>{rota.tms_lm_veiculos?.placa ?? "—"}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Entregas</div><div className="font-bold">{entregas.length}</div></div>
        <div><div className="text-[10px] uppercase text-muted-foreground">Valor</div><div className="font-bold">R$ {Number(rota.valor_rota || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entregas.map((e: any) => (
          <div key={e.id} onClick={() => setPodId(e.id)} className="cursor-pointer">
            <EntregaCard e={{ ...e, cliente: e.tms_clientes?.nome, codigo_qr: `LM-${rota.numero}-${e.id.slice(0, 6)}` }} />
          </div>
        ))}
        {!entregas.length && <div className="col-span-full text-center text-muted-foreground py-10">Sem entregas nesta rota</div>}
      </div>

      <Dialog open={!!podId} onOpenChange={(o) => !o && setPodId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comprovante de Entrega</DialogTitle></DialogHeader>
          {podId && <PodCapture entregaId={podId} onSaved={() => { setPodId(null); refetch(); }} />}
        </DialogContent>
      </Dialog>
    </TmsShell>
  );
}
