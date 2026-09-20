import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PackageSearch, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rastrearEmbarque, type RastreioResultado } from "@/lib/pxsales-tracking.functions";

export const Route = createFileRoute("/rastreio")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rastrear embarque | Grupo PX" },
      { name: "description", content: "Acompanhe em tempo real a situação do seu embarque com o Grupo PX." },
      { property: "og:title", content: "Rastrear embarque — Grupo PX" },
      { property: "og:description", content: "Acompanhe em tempo real a situação do seu embarque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RastreioPage,
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

function RastreioPage() {
  const consultar = useServerFn(rastrearEmbarque);
  const [numero, setNumero] = useState("");
  const [documento, setDocumento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<RastreioResultado | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    setRes(null);
    try {
      setRes(await consultar({ data: { numero, documento } }));
    } catch (err: any) {
      setErro(err?.message ?? "Não foi possível consultar agora.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          <span className="font-semibold">Grupo PX — Acompanhe seu embarque</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <form onSubmit={buscar} className="rounded-xl border p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Informe o número do embarque e o CNPJ ou CPF do contratante.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Número do embarque" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input placeholder="CNPJ ou CPF" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            <Button type="submit" disabled={carregando}>
              <PackageSearch className="size-4 mr-1.5" /> Consultar
            </Button>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </form>

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
                <li className="text-sm text-muted-foreground">Embarque registrado em {dh(res.criada_em)}. Aguardando movimentação.</li>
              ) : (
                res.eventos.map((ev, idx) => (
                  <li key={`${ev.tipo}-${idx}`} className="flex gap-3">
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
      </main>
    </div>
  );
}
