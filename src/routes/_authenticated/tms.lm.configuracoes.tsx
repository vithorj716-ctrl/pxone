import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, User, Truck, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/configuracoes")({
  head: () => ({ meta: [{ title: "Last Mile — Configurações" }] }),
  component: LmConfig,
});

function LmConfig() {
  const [tab, setTab] = useState<"motoristas" | "veiculos" | "rotas">("motoristas");
  const qc = useQueryClient();
  const { data: mots } = useQuery({ queryKey: ["lm-mots"], queryFn: async () => (await supabase.from("tms_lm_motoristas").select("*").order("nome")).data ?? [] });
  const { data: veics } = useQuery({ queryKey: ["lm-veics"], queryFn: async () => (await supabase.from("tms_lm_veiculos").select("*").order("placa")).data ?? [] });
  const { data: rotas } = useQuery({ queryKey: ["lm-rotas-cfg"], queryFn: async () => (await supabase.from("tms_lm_rotas").select("*").order("data", { ascending: false }).limit(50)).data ?? [] });

  async function addMot() {
    const nome = prompt("Nome do motorista"); if (!nome) return;
    await supabase.from("tms_lm_motoristas").insert({ nome });
    qc.invalidateQueries({ queryKey: ["lm-mots"] }); toast.success("Motorista criado");
  }
  async function addVeic() {
    const placa = prompt("Placa"); if (!placa) return;
    const modelo = prompt("Modelo") ?? "";
    await supabase.from("tms_lm_veiculos").insert({ placa, modelo });
    qc.invalidateQueries({ queryKey: ["lm-veics"] }); toast.success("Veículo criado");
  }
  async function addRota() {
    const cidade = prompt("Cidade") ?? "";
    await supabase.from("tms_lm_rotas").insert({ cidade, status: "planejada" });
    qc.invalidateQueries({ queryKey: ["lm-rotas-cfg"] }); toast.success("Rota criada");
  }

  return (
    <TmsShell title="Last Mile" subtitle="Configurações">
      <div className="flex gap-1.5">
        {(["motoristas", "veiculos", "rotas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-xs uppercase tracking-wider font-bold ${tab === t ? "bg-foreground text-background" : "bg-surface ring-1 ring-border"}`}>{t}</button>
        ))}
      </div>

      {tab === "motoristas" && (
        <>
          <button onClick={addMot} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Novo motorista</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(mots ?? []).map((m: any) => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3"><User className="size-4 text-muted-foreground" /><span className="flex-1">{m.nome}</span><span className="text-xs text-muted-foreground">{m.telefone ?? "—"}</span></div>
            ))}
            {!mots?.length && <div className="px-4 py-8 text-center text-muted-foreground">Sem motoristas</div>}
          </div>
        </>
      )}
      {tab === "veiculos" && (
        <>
          <button onClick={addVeic} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Novo veículo</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(veics ?? []).map((v: any) => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3"><Truck className="size-4 text-muted-foreground" /><span className="font-mono font-bold">{v.placa}</span><span className="flex-1 text-muted-foreground">{v.modelo}</span><span className="text-xs">{v.capacidade_kg}kg</span></div>
            ))}
            {!veics?.length && <div className="px-4 py-8 text-center text-muted-foreground">Sem veículos</div>}
          </div>
        </>
      )}
      {tab === "rotas" && (
        <>
          <button onClick={addRota} className="text-xs px-3 py-1.5 rounded bg-green-600 text-white inline-flex items-center gap-1.5"><Plus className="size-3.5" /> Nova rota</button>
          <div className="rounded-xl ring-1 ring-border bg-surface divide-y divide-border">
            {(rotas ?? []).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3"><RouteIcon className="size-4 text-muted-foreground" /><span className="font-mono font-bold">#{r.numero}</span><span className="flex-1">{r.cidade ?? "—"}</span><span className="text-xs uppercase">{r.status}</span></div>
            ))}
          </div>
        </>
      )}
    </TmsShell>
  );
}
