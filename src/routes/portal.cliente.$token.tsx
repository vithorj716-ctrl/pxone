import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Package, FileSpreadsheet, Table2, CheckCircle2, XCircle, MessageSquare, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPortalCliente,
  responderCotacaoPortal,
  solicitarCotacaoPortal,
} from "@/lib/pxsales-portal-cliente.functions";

export const Route = createFileRoute("/portal/cliente/$token")({
  head: () => ({
    meta: [
      { title: "Portal do cliente | Grupo PX" },
      { name: "description", content: "Acompanhe sua tabela comercial, cotações, entregas e comprovantes do Grupo PX." },
      { property: "og:title", content: "Portal do cliente — Grupo PX" },
      { property: "og:description", content: "Tabela comercial, cotações e comprovantes de entrega em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalCliente,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: string) => new Date(v).toLocaleString("pt-BR");

function PortalCliente() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [aba, setAba] = useState("tabela");

  const fetchPortal = useServerFn(getPortalCliente);
  const responder = useServerFn(responderCotacaoPortal);
  const solicitar = useServerFn(solicitarCotacaoPortal);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-cliente", token],
    queryFn: () => fetchPortal({ data: { token } }),
    retry: false,
  });

  const [pedido, setPedido] = useState({ origem: "", destino: "", peso: "", volumes: "1", valor_mercadoria: "", observacoes: "" });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando seu portal…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center">
          <XCircle className="size-6 mx-auto text-destructive mb-2" />
          <p className="text-sm">{(error as any)?.message ?? "Não foi possível abrir este portal."}</p>
          <p className="text-xs text-muted-foreground mt-2">Peça um novo link ao time comercial do Grupo PX.</p>
        </div>
      </div>
    );
  }

  const p = data.permissoes;
  const abas = [
    p["ver_tabela"] && { k: "tabela", l: "Minha tabela", icon: Table2 },
    p["ver_cotacoes"] && { k: "cotacoes", l: "Cotações", icon: FileSpreadsheet },
    (p["ver_entregas"] || p["ver_comprovantes"]) && { k: "entregas", l: "Entregas", icon: Package },
    p["solicitar_cotacao"] && { k: "solicitar", l: "Solicitar cotação", icon: MessageSquare },
  ].filter(Boolean) as { k: string; l: string; icon: any }[];

  async function responderCotacao(id: string, acao: "aceitar" | "recusar" | "alteracao") {
    try {
      await responder({ data: { token, cotacao_id: id, acao } });
      toast.success(acao === "aceitar" ? "Cotação aceita. Nosso time dará sequência." : "Resposta registrada.");
      qc.invalidateQueries({ queryKey: ["portal-cliente", token] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar a resposta.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Grupo PX · Portal do cliente</div>
          <h1 className="text-lg font-semibold">{data.cliente.nome}</h1>
        </div>
      </header>

      <nav className="border-b border-border overflow-x-auto">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {abas.map((a) => (
            <button
              key={a.k}
              onClick={() => setAba(a.k)}
              className={`px-3 py-2.5 text-xs whitespace-nowrap border-b-2 ${
                aba === a.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {a.l}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {aba === "tabela" &&
          (!data.tabela ? (
            <Vazio texto="Nenhuma tabela disponível para consulta no momento." />
          ) : (
            <div className="rounded-xl ring-1 ring-border p-4">
              <div className="text-sm font-medium">{data.tabela.nome}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Versão {data.tabela.versao} · vigente desde {data.tabela.vigencia_inicio}
                {data.tabela.vigencia_fim ? ` até ${data.tabela.vigencia_fim}` : ""}
              </div>
              <div className="mt-3 divide-y divide-border">
                {data.tabela.componentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Detalhamento não disponível para consulta.</p>
                ) : (
                  data.tabela.componentes.map((c: any, i: number) => (
                    <div key={i} className="py-2.5">
                      <div className="text-xs font-medium">{c.nome}</div>
                      {c.config && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {Object.entries(c.config)
                            .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </div>
                      )}
                      {c.faixas?.length > 0 && (
                        <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                          {c.faixas.map((f: any, j: number) => (
                            <div key={j} className="text-[11px] flex justify-between rounded bg-muted/30 px-2 py-1">
                              <span>
                                {f.peso_min}–{f.peso_max} kg
                              </span>
                              <span className="tabular-nums">
                                {f.tipo_valor === "percentual" ? `${f.valor}%` : brl(Number(f.valor))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

        {aba === "cotacoes" &&
          (data.cotacoes.length === 0 ? (
            <Vazio texto="Nenhuma cotação disponível." />
          ) : (
            <div className="space-y-2">
              {data.cotacoes.map((c: any) => (
                <div key={c.id} className="rounded-xl ring-1 ring-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {c.origem_cidade}
                        {c.origem_uf ? `/${c.origem_uf}` : ""} → {c.destino_cidade}
                        {c.destino_uf ? `/${c.destino_uf}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.numero ? `Nº ${c.numero} · ` : ""}
                        {dt(c.created_at)}
                        {c.validade_ate ? ` · válida até ${c.validade_ate}` : ""}
                        {c.tabela_nome ? ` · ${c.tabela_nome} v${c.tabela_versao}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{brl(Number(c.valor_total))}</div>
                      <div className="text-[10px] text-muted-foreground">{c.status}</div>
                    </div>
                  </div>
                  {!["aprovada", "recusada", "cancelada", "convertida"].includes(c.status) && (
                    <div className="flex gap-1.5 mt-3">
                      <Button size="sm" onClick={() => responderCotacao(c.id, "aceitar")}>
                        <CheckCircle2 className="size-3.5 mr-1" /> Aceitar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => responderCotacao(c.id, "alteracao")}>
                        Pedir alteração
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => responderCotacao(c.id, "recusar")}>
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

        {aba === "entregas" &&
          (data.operacoes.length === 0 ? (
            <Vazio texto="Nenhuma operação encontrada para o seu cadastro." />
          ) : (
            <div className="space-y-2">
              {data.operacoes.map((m: any) => (
                <div key={m.id} className="rounded-xl ring-1 ring-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {m.numero ? `Minuta ${m.numero}` : "Minuta"} · {m.origem} → {m.destino}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {dt(m.created_at)} · {m.qtd_volumes} volume(s) · {m.peso} kg
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{m.status}</span>
                  </div>

                  {m.eventos?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {m.eventos.slice(-6).map((e: any, i: number) => (
                        <div key={i} className="text-[11px] text-muted-foreground flex justify-between">
                          <span>{String(e.tipo).replace(/_/g, " ")}</span>
                          <span>{dt(e.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.comprovantes?.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2 space-y-1.5">
                      {m.comprovantes.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-[11px]">
                          <span>
                            Comprovante · recebido por {c.recebedor_nome || "—"} em {dt(c.created_at)}
                          </span>
                          {c.arquivo ? (
                            <a
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              href={c.arquivo}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download className="size-3" /> Abrir
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{c.disponivel ? "Disponível na operação" : "—"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

        {aba === "solicitar" && (
          <div className="rounded-xl ring-1 ring-border p-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">Origem</Label>
              <Input value={pedido.origem} onChange={(e) => setPedido({ ...pedido, origem: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Destino</Label>
              <Input value={pedido.destino} onChange={(e) => setPedido({ ...pedido, destino: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Peso (kg)</Label>
              <Input value={pedido.peso} onChange={(e) => setPedido({ ...pedido, peso: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Volumes</Label>
              <Input value={pedido.volumes} onChange={(e) => setPedido({ ...pedido, volumes: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Valor da mercadoria</Label>
              <Input
                value={pedido.valor_mercadoria}
                onChange={(e) => setPedido({ ...pedido, valor_mercadoria: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[11px]">Observações</Label>
              <Textarea
                rows={2}
                value={pedido.observacoes}
                onChange={(e) => setPedido({ ...pedido, observacoes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={async () => {
                  try {
                    await solicitar({ data: { token, ...pedido } });
                    toast.success("Solicitação enviada ao time comercial.");
                    setPedido({ origem: "", destino: "", peso: "", volumes: "1", valor_mercadoria: "", observacoes: "" });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Não foi possível enviar.");
                  }
                }}
              >
                Enviar solicitação
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="rounded-xl ring-1 ring-border p-10 text-center text-xs text-muted-foreground">{texto}</div>;
}
