import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getPropostaPublica, responderPropostaPublica } from "@/lib/pxsales-portal.functions";

export const Route = createFileRoute("/portal/proposta/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Proposta comercial | Grupo PX" },
      { name: "description", content: "Consulte e responda a proposta de frete enviada pelo Grupo PX." },
      { property: "og:title", content: "Proposta comercial — Grupo PX" },
      { property: "og:description", content: "Consulte e responda a proposta de frete enviada pelo Grupo PX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalProposta,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

function PortalProposta() {
  const { token } = Route.useParams();
  const carregar = useServerFn(getPropostaPublica);
  const responder = useServerFn(responderPropostaPublica);

  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => carregar({ data: { token } }),
    retry: false,
  });

  async function enviar(acao: "aceitar" | "recusar" | "alteracao") {
    if (acao !== "aceitar" && !mensagem.trim()) {
      toast.error("Conte rapidamente o motivo para o time comercial.");
      return;
    }
    setEnviando(true);
    try {
      const r = await responder({ data: { token, acao, mensagem, nome } });
      setResposta(r.status);
      toast.success(
        acao === "aceitar" ? "Proposta aceita. Obrigado!" : acao === "recusar" ? "Recusa registrada." : "Pedido de ajuste enviado.",
      );
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar sua resposta.");
    } finally {
      setEnviando(false);
    }
  }

  if (isLoading) return <Centro>Carregando proposta…</Centro>;
  if (error) return <Centro>{(error as any)?.message ?? "Link indisponível."}</Centro>;
  if (!data) return <Centro>Link indisponível.</Centro>;

  const fechada = data.respondida || !!resposta || data.expirada;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <span className="font-semibold">Grupo PX — Proposta comercial</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <section className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground">Proposta nº {data.numero}</p>
          <h1 className="text-xl font-semibold mt-1">{data.titulo}</h1>
          <p className="text-sm text-muted-foreground mt-1">{data.empresa_nome}</p>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Item rotulo="Valor" valor={brl(data.valor_total)} destaque />
            <Item rotulo="Validade" valor={dia(data.validade_ate)} />
            <Item rotulo="Pagamento" valor={data.condicao_pagamento ?? "—"} />
            <Item rotulo="Prazo" valor={data.cotacao ? `${data.cotacao.prazo_dias} dia(s)` : "—"} />
          </div>
        </section>

        {data.cotacao && (
          <section className="rounded-xl border p-5">
            <h2 className="text-sm font-medium mb-3">Transporte</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Item rotulo="Origem" valor={data.cotacao.origem} />
              <Item rotulo="Destino" valor={data.cotacao.destino} />
              <Item rotulo="Volumes" valor={String(data.cotacao.qtd_volumes)} />
              <Item rotulo="Peso" valor={`${data.cotacao.peso} kg`} />
            </div>
          </section>
        )}

        {(data.escopo || data.condicoes) && (
          <section className="rounded-xl border p-5 space-y-3">
            {data.escopo && (
              <div>
                <h2 className="text-sm font-medium">Escopo</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{data.escopo}</p>
              </div>
            )}
            {data.condicoes && (
              <div>
                <h2 className="text-sm font-medium">Condições</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{data.condicoes}</p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border p-5">
          {data.expirada ? (
            <p className="text-sm text-amber-600">Este link expirou. Fale com seu contato comercial para receber uma nova proposta.</p>
          ) : fechada ? (
            <p className="text-sm text-emerald-600">
              Sua resposta foi registrada. O time comercial do Grupo PX entrará em contato.
            </p>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Sua resposta</h2>
              <Input placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Textarea
                placeholder="Mensagem para o time comercial (obrigatória em caso de recusa ou pedido de ajuste)"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={enviando} onClick={() => enviar("aceitar")}>
                  <CheckCircle2 className="size-4 mr-1.5" /> Aceitar proposta
                </Button>
                <Button variant="outline" disabled={enviando} onClick={() => enviar("alteracao")}>
                  <MessageSquare className="size-4 mr-1.5" /> Pedir alteração
                </Button>
                <Button variant="outline" disabled={enviando} onClick={() => enviar("recusar")}>
                  <XCircle className="size-4 mr-1.5" /> Recusar
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Item({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={destaque ? "text-lg font-semibold" : "text-sm font-medium"}>{valor}</p>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center text-sm text-muted-foreground">{children}</div>
  );
}
