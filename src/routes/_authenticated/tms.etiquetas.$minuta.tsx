import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrLabel } from "@/components/tms/qr-label";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/etiquetas/$minuta")({
  head: () => ({ meta: [{ title: "PXLog — Etiquetas" }] }),
  component: EtiquetasPage,
});

function EtiquetasPage() {
  const { minuta: numero } = useParams({ from: "/_authenticated/tms/etiquetas/$minuta" });
  const [minuta, setMinuta] = useState<any | null>(null);
  const [volumes, setVolumes] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("tms_minutas")
        .select("*, tms_clientes(nome)")
        .eq("numero", Number(numero))
        .maybeSingle();
      if (!m) return;
      setMinuta(m);
      const { data: v } = await supabase.from("tms_volumes").select("*").eq("minuta_id", (m as any).id).order("numero");
      setVolumes((v ?? []) as any[]);
      // Marca como etiquetado
      await supabase.from("tms_eventos").insert({ minuta_id: (m as any).id, tipo: "etiquetado", origem_evento: "Impressão de etiquetas" });
    })();
  }, [numero]);

  if (!minuta) return <div className="p-6">Carregando…</div>;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div className="text-sm text-slate-700">
            <div className="font-semibold">Etiquetas — Minuta #{minuta.numero}</div>
            <div className="text-xs">{volumes.length} volume(s) · {minuta.origem} → {minuta.destino}</div>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm">
            <Printer className="size-4" /> Imprimir todas
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-1 print:gap-0">
          {volumes.map((v) => (
            <QrLabel
              key={v.id}
              codigo={v.codigo}
              numeroMinuta={minuta.numero}
              numeroVol={v.numero}
              totalVol={minuta.qtd_volumes}
              cliente={minuta.tms_clientes?.nome}
              remetente={minuta.remetente?.nome}
              destinatario={minuta.destinatario?.nome}
              origem={minuta.origem}
              destino={minuta.destino}
              cidadeDestino={minuta.destino}
              peso={Number(v.peso).toFixed(2) as any}
              data={new Date(minuta.created_at).toLocaleDateString("pt-BR")}
            />
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .tms-label { box-shadow: none !important; }
          @page { size: 100mm 150mm; margin: 0; }
        }
      `}</style>
    </div>
  );
}
