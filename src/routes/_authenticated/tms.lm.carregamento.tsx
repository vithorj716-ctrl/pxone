import { createFileRoute } from "@tanstack/react-router";
import { TmsShell } from "@/components/tms/tms-shell";
import { ScanInput } from "@/components/tms/scan-input";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/carregamento")({
  head: () => ({ meta: [{ title: "Last Mile — Carregamento" }] }),
  component: LmCarregamento,
});

function LmCarregamento() {
  const [rotaNumero, setRotaNumero] = useState<string>("");
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [resumo, setResumo] = useState({ carregados: 0, restantes: 0, peso: 0, cubagem: 0, total: 0 });

  async function recarregar(id: string) {
    const { data: vols } = await supabase.from("tms_lm_volumes").select("status, tms_lm_entregas!inner(rota_id, peso, cubagem)").eq("tms_lm_entregas.rota_id", id);
    const carr = (vols ?? []).filter((v: any) => ["carregado", "saiu_entrega", "entregue"].includes(v.status)).length;
    const total = (vols ?? []).length;
    const peso = (vols ?? []).reduce((a: number, b: any) => a + Number(b.tms_lm_entregas?.peso || 0), 0);
    const cub = (vols ?? []).reduce((a: number, b: any) => a + Number(b.tms_lm_entregas?.cubagem || 0), 0);
    setResumo({ carregados: carr, restantes: total - carr, peso, cubagem: cub, total });
  }

  async function abrirRota() {
    const { data: r } = await supabase.from("tms_lm_rotas").select("id").eq("numero", Number(rotaNumero)).maybeSingle();
    if (!r) return toast.error("Rota não encontrada");
    setRotaId(r.id);
    await supabase.from("tms_lm_rotas").update({ status: "carregando" }).eq("id", r.id);
    recarregar(r.id);
  }

  async function bipar(codigo: string) {
    if (!rotaId) { toast.error("Abra uma rota primeiro"); return; }
    const { data: vol } = await supabase.from("tms_lm_volumes").select("*, tms_lm_entregas!inner(rota_id)").eq("codigo", codigo).maybeSingle();
    if (!vol) { toast.error("Volume não encontrado"); return; }
    if ((vol as any).tms_lm_entregas?.rota_id !== rotaId) { toast.error("Volume não pertence à rota"); return; }
    await supabase.from("tms_lm_volumes").update({ status: "carregado", carregado_em: new Date().toISOString() }).eq("id", vol.id);
    await supabase.from("tms_lm_entregas").update({ status: "carregado" }).eq("id", vol.entrega_id);
    await supabase.from("tms_lm_eventos").insert({ entrega_id: vol.entrega_id, rota_id: rotaId, tipo: "carregado", payload: { codigo } });
    toast.success("Carregado");
    recarregar(rotaId);
  }

  const pct = resumo.total ? Math.round((resumo.carregados / resumo.total) * 100) : 0;

  return (
    <TmsShell title="Last Mile" subtitle="Carregamento">
      {!rotaId ? (
        <div className="max-w-md mx-auto space-y-3 py-8">
          <label className="block text-sm font-semibold">Número da Rota</label>
          <input value={rotaNumero} onChange={(e) => setRotaNumero(e.target.value)} placeholder="Ex: 1042" className="w-full px-4 py-3 bg-surface ring-1 ring-border rounded-lg text-lg font-mono" />
          <button onClick={abrirRota} className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold">Abrir rota</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Carregados</div><div className="text-2xl font-bold text-orange-500">{resumo.carregados}</div></div>
            <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Restantes</div><div className="text-2xl font-bold">{resumo.restantes}</div></div>
            <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Peso</div><div className="text-2xl font-bold">{resumo.peso.toFixed(0)}kg</div></div>
            <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">Cubagem</div><div className="text-2xl font-bold">{resumo.cubagem.toFixed(2)}m³</div></div>
            <div className="rounded-xl ring-1 ring-border bg-surface p-4"><div className="text-[10px] uppercase text-muted-foreground">% Carregado</div><div className="text-2xl font-bold text-green-500">{pct}%</div></div>
          </div>
          <div className="h-3 rounded-full bg-surface ring-1 ring-border overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ScanInput onScan={bipar} placeholder="Bipe etiqueta para carregar…" />
          {pct === 100 && (
            <button onClick={async () => {
              await supabase.from("tms_lm_rotas").update({ status: "em_rota", hora_saida: new Date().toISOString() }).eq("id", rotaId);
              await supabase.from("tms_lm_entregas").update({ status: "saiu_entrega" }).eq("rota_id", rotaId);
              toast.success("Romaneio gerado · Rota em rota");
              window.print();
            }} className="w-full py-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold inline-flex items-center justify-center gap-2">
              <Truck className="size-4" /> Finalizar carregamento e gerar romaneio
            </button>
          )}
        </>
      )}
    </TmsShell>
  );
}
