import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrLabel } from "@/components/tms/qr-label";
import { Printer } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/tms/etiquetas/$minuta")({
  head: () => ({ meta: [{ title: "PXLog — Etiquetas" }] }),
  validateSearch: z.object({ print: z.coerce.number().optional() }),
  component: EtiquetasPage,
});

function EtiquetasPage() {
  const { minuta: numero } = useParams({ from: "/_authenticated/tms/etiquetas/$minuta" });
  const { print: printFlag } = useSearch({ from: "/_authenticated/tms/etiquetas/$minuta" });
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
      await supabase.from("tms_eventos").insert({ minuta_id: (m as any).id, tipo: "etiquetado", origem_evento: "Impressão de etiquetas" });
    })();
  }, [numero]);

  useEffect(() => {
    if (printFlag && minuta && volumes.length > 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [printFlag, minuta, volumes.length]);

  if (!minuta) return <div className="p-6">Carregando…</div>;

  const dest = (minuta.destinatario || {}) as any;
  const rem = (minuta.remetente || {}) as any;
  const flags: string[] = (() => {
    const obs = String(minuta.observacoes || "").toLowerCase();
    const out: string[] = [];
    ["fragil", "empilhar", "nao_empilhar", "urgente", "medicamento", "controlado", "refrigerado", "inflamavel"].forEach((f) => {
      if (obs.includes(f.replace("_", " ")) || obs.includes(f)) out.push(f);
    });
    return out;
  })();

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white p-4 print:p-0">
      <div className="max-w-5xl mx-auto print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div className="text-sm text-slate-800">
            <div className="font-semibold">Etiquetas — Minuta #{minuta.numero}</div>
            <div className="text-xs">{volumes.length} volume(s) · {minuta.origem} → {minuta.destino}</div>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm">
            <Printer className="size-4" /> Imprimir todas
          </button>
        </div>

        <div className="flex flex-wrap gap-4 justify-center print:gap-0 print:block">
          {volumes.map((v) => (
            <QrLabel
              key={v.id}
              codigo={v.codigo}
              numeroMinuta={minuta.numero}
              numeroVol={v.numero}
              totalVol={minuta.qtd_volumes}
              status={minuta.status}
              flags={flags}
              cliente={minuta.tms_clientes?.nome}
              remetente={rem.nome}
              destinatario={dest.nome}
              telefone={dest.telefone}
              rua={dest.rua || dest.endereco}
              numero={dest.numero}
              bairro={dest.bairro}
              cidadeDestino={dest.cidade}
              cep={dest.cep}
              origem={minuta.origem}
              destino={minuta.destino}
              pesoReal={Number(v.peso ?? minuta.peso ?? 0)}
              pesoCubado={Number(minuta.peso_cubado ?? 0)}
              pesoTaxado={Number(minuta.peso_taxado ?? 0)}
              cubagem={Number(minuta.cubagem ?? 0)}
              tipoMercadoria={minuta.tipo_mercadoria}
              hubOrigem={minuta.origem}
              hubDestino={minuta.destino}
              prazoDias={minuta.prazo_dias}
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
