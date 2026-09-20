import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PackageSearch, Copy } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { rastrearEmbarque, type RastreioResultado } from "@/lib/pxsales-tracking.functions";

export const Route = createFileRoute("/_authenticated/sales/tracking")({
  head: () => ({
    meta: [
      { title: "PXSales — Acompanhamento de cargas | Grupo PX" },
      { name: "description", content: "Consulte a situação dos embarques do cliente com os dados reais da operação." },
      { property: "og:title", content: "PXSales — Acompanhamento de cargas" },
      { property: "og:description", content: "Situação dos embarques com dados reais da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackingPage,
});

const LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  coleta_programada: "Coleta programada",
  coletado: "Coletado",
  recebido_hub_origem: "Recebido na origem",
  conferido: "Conferido",
  etiquetado: "Etiquetado",
  embarcado: "Embarcado",
  em_transferencia: "Em transferência",
  recebido_hub_destino: "Recebido no destino",
  separado: "Separado",
  em_rota: "Em rota",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  ocorrencia: "Ocorrência",
  devolucao: "Devolução",
};

const dh = (v: string) => new Date(v).toLocaleString("pt-BR");

function TrackingPage() {
  const consultar = useServerFn(rastrearEmbarque);
  const [numero, setNumero] = useState("");
  const [documento, setDocumento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<RastreioResultado | null>(null);

  async function buscar() {
    setErro(null);
    setCarregando(true);
    setRes(null);
    try {
      setRes(await consultar({ data: { numero, documento } }));
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível consultar.");
    } finally {
      setCarregando(false);
    }
  }

  async function copiarLink() {
    const base = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard.writeText(`${base}/rastreio`);
    toast.success("Link público copiado para enviar ao cliente.");
  }

  return (
    <PxSalesShell title="Acompanhamento" subtitle="Cargas em andamento">
      <div className="space-y-4">
        <div className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            O cliente acompanha sozinho pela página pública <Link to="/rastreio" className="underline">/rastreio</Link>, informando o
            número do embarque e o CNPJ/CPF.
          </span>
          <Button size="sm" variant="outline" onClick={copiarLink}><Copy className="size-4 mr-1.5" /> Copiar link do cliente</Button>
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Número do embarque" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input placeholder="CNPJ ou CPF do contratante" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            <Button onClick={buscar} disabled={carregando}><PackageSearch className="size-4 mr-1.5" /> Consultar</Button>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        {res && (
          <section className="rounded-xl border p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Embarque nº {res.numero}</p>
                <p className="font-semibold">{LABEL[res.status] ?? res.status}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {res.origem ?? "—"} → {res.destino ?? "—"}
                {res.previsao_dias ? ` · previsão ${res.previsao_dias} dia(s)` : ""}
              </p>
            </div>
            <ol className="space-y-3">
              {res.eventos.length === 0 ? (
                <li className="text-sm text-muted-foreground">Registrado em {dh(res.criada_em)}. Sem movimentação ainda.</li>
              ) : (
                res.eventos.map((ev, i) => (
                  <li key={`${ev.tipo}-${i}`} className="flex gap-3">
                    <span className="mt-1 size-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{LABEL[ev.tipo] ?? ev.tipo}</p>
                      <p className="text-xs text-muted-foreground">{dh(ev.data)}</p>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </section>
        )}
      </div>
    </PxSalesShell>
  );
}
