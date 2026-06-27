import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { Camera, FileSignature, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/lm/comprovantes")({
  head: () => ({ meta: [{ title: "Last Mile — Comprovantes" }] }),
  component: LmComprovantes,
});

function LmComprovantes() {
  const { data } = useQuery({
    queryKey: ["lm-pods"],
    queryFn: async () => {
      const { data } = await supabase.from("tms_lm_comprovantes").select("*, tms_lm_entregas(destinatario, cidade, tms_lm_rotas(numero))").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  return (
    <TmsShell title="Last Mile" subtitle="Comprovantes Digitais (POD)">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(data ?? []).map((c: any) => (
          <div key={c.id} className="rounded-xl ring-1 ring-border bg-surface p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold truncate">{c.tms_lm_entregas?.destinatario ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div className="text-xs text-muted-foreground">Rota #{c.tms_lm_entregas?.tms_lm_rotas?.numero ?? "—"} · {c.tms_lm_entregas?.cidade ?? ""}</div>
            {c.recebedor_nome && <div className="text-sm">Recebido por: <strong>{c.recebedor_nome}</strong></div>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {c.foto_mercadoria && <span className="inline-flex items-center gap-1"><Camera className="size-3" /> Mercadoria</span>}
              {c.foto_fachada && <span className="inline-flex items-center gap-1"><Camera className="size-3" /> Fachada</span>}
              {c.assinatura_base64 && <span className="inline-flex items-center gap-1"><FileSignature className="size-3" /> Assinatura</span>}
              {c.lat && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> GPS</span>}
            </div>
            {c.assinatura_base64 && <img src={c.assinatura_base64} alt="assinatura" className="bg-white rounded p-1 max-h-24" />}
          </div>
        ))}
        {!data?.length && <div className="col-span-full text-center text-muted-foreground py-12">Sem comprovantes</div>}
      </div>
    </TmsShell>
  );
}
