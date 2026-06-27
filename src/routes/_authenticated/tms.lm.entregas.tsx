import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { EntregaCard } from "@/components/tms/lm/entrega-card";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/entregas")({
  head: () => ({ meta: [{ title: "Last Mile — Entregas" }] }),
  component: LmEntregas,
});

function LmEntregas() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["lm-entregas"],
    queryFn: async () => {
      const { data } = await supabase.from("tms_lm_entregas").select("*, tms_clientes(nome), tms_lm_rotas(numero)").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });
  const filtered = (data ?? []).filter((e: any) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return [e.destinatario, e.telefone, e.endereco, e.cidade, e.tms_clientes?.nome, String(e.tms_lm_rotas?.numero)].filter(Boolean).some((s) => String(s).toLowerCase().includes(t));
  });

  return (
    <TmsShell title="Last Mile" subtitle="Entregas">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar destinatário, cliente, telefone, endereço, rota…" className="w-full pl-10 pr-4 py-3 bg-surface ring-1 ring-border rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((e: any) => (
          <EntregaCard key={e.id} e={{ ...e, cliente: e.tms_clientes?.nome, codigo_qr: `LM-${e.tms_lm_rotas?.numero}-${e.id.slice(0, 6)}` }} />
        ))}
        {!filtered.length && <div className="col-span-full text-center text-muted-foreground py-12">Nenhuma entrega encontrada</div>}
      </div>
    </TmsShell>
  );
}
