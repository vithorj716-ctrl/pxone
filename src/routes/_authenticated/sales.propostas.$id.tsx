import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Truck, Trash2, Link2 } from "lucide-react";
import { gerarLinkPortal } from "@/lib/pxsales-portal.functions";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import {
  getProposta,
  setStatusProposta,
  excluirProposta,
  enviarPropostaParaPxLog,
} from "@/lib/pxsales-cotacoes.functions";
import { STATUS_PROPOSTA } from "@/pxsales/frete-calc";

export const Route = createFileRoute("/_authenticated/sales/propostas/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Proposta | Grupo PX" },
      { name: "description", content: "Detalhe da proposta comercial, condições, aceite e envio para a operação." },
      { property: "og:title", content: "PXSales — Proposta" },
      { property: "og:description", content: "Detalhe da proposta comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropostaDetalhe,
});

const brl = (v: any) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function PropostaDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fnGet = useServerFn(getProposta);
  const fnStatus = useServerFn(setStatusProposta);
  const fnExcluir = useServerFn(excluirProposta);
  const fnPxLog = useServerFn(enviarPropostaParaPxLog);
  const fnLink = useServerFn(gerarLinkPortal);

  async function gerarLink() {
    try {
      const r = await fnLink({ data: { proposta_id: id, dias: 15 } });
      const url = `${window.location.origin}/portal/proposta/${r.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link do cliente copiado. Válido por 15 dias.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o link");
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["pxsales", "proposta", id],
    queryFn: () => fnGet({ data: { id } }),
  });

  const p = data?.proposta;

  async function mudarStatus(status: string) {
    let motivo: string | undefined;
    if (status === "recusada") motivo = prompt("Motivo da recusa (opcional)") ?? undefined;
    await fnStatus({ data: { id, status, motivo } });
    toast.success("Situação da proposta atualizada");
    void qc.invalidateQueries({ queryKey: ["pxsales", "proposta", id] });
    void qc.invalidateQueries({ queryKey: ["pxsales", "propostas"] });
  }

  async function enviarOperacao() {
    try {
      const r = await fnPxLog({ data: { proposta_id: id } });
      toast.success(`Embarque nº ${r.numero} criado no PXLog`);
      void qc.invalidateQueries({ queryKey: ["pxsales", "proposta", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar para a operação");
    }
  }

  async function remover() {
    if (!confirm("Excluir esta proposta?")) return;
    await fnExcluir({ data: { id } });
    toast.success("Proposta excluída");
    void navigate({ to: "/sales/propostas" });
  }

  return (
    <PxSalesShell title="Proposta" subtitle={p ? `nº ${p.numero}` : id}>
      <div className="space-y-4">
        <Link to="/sales/propostas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar para propostas
        </Link>

        {isLoading || !p ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{p.titulo}</h2>
                  <p className="text-sm text-muted-foreground">{p.empresa_nome}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{brl(p.valor_total)}</p>
                  <select
                    className="mt-2 h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={p.status}
                    onChange={(e) => void mudarStatus(e.target.value)}
                  >
                    {STATUS_PROPOSTA.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {data.minuta ? (
                  <Link to="/tms/minutas/$numero" params={{ numero: String(data.minuta.numero) }} className="inline-flex">
                    <Button variant="outline"><Truck className="size-4 mr-1.5" /> Embarque nº {data.minuta.numero} no PXLog</Button>
                  </Link>
                ) : (
                  <Button onClick={enviarOperacao} disabled={p.status !== "aceita"}>
                    <Truck className="size-4 mr-1.5" /> Enviar para a operação (PXLog)
                  </Button>
                )}
                {data.cotacao && (
                  <Link to="/sales/cotacoes/$id" params={{ id: data.cotacao.id }} className="inline-flex">
                    <Button variant="outline">Ver cotação nº {data.cotacao.numero}</Button>
                  </Link>
                )}
                <Button variant="outline" onClick={gerarLink}><Link2 className="size-4 mr-1.5" /> Gerar link do cliente</Button>
                <Button variant="ghost" className="text-red-600" onClick={remover}><Trash2 className="size-4 mr-1.5" /> Excluir</Button>
              </div>
              {p.status !== "aceita" && !data.minuta && (
                <p className="mt-2 text-xs text-muted-foreground">O embarque só pode ser criado depois que a proposta for marcada como aceita.</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Bloco titulo="Condições">
                <Linha k="Pagamento" v={p.condicao_pagamento ?? "—"} />
                <Linha k="Validade" v={p.validade_ate ? new Date(`${p.validade_ate}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
                <Linha k="Enviada em" v={dt(p.enviada_em)} />
                <Linha k="Visualizada em" v={dt(p.visualizada_em)} />
                <Linha k="Aceita em" v={dt(p.aceita_em)} />
                <Linha k="Recusada em" v={dt(p.recusada_em)} />
                {p.motivo && <Linha k="Motivo" v={p.motivo} />}
              </Bloco>

              <Bloco titulo="Escopo">
                <p className="text-sm whitespace-pre-wrap">{p.escopo ?? "—"}</p>
                {p.condicoes && <p className="text-sm whitespace-pre-wrap mt-2">{p.condicoes}</p>}
              </Bloco>

              {data.cotacao && (
                <Bloco titulo="Cotação base">
                  <Linha
                    k="Trecho"
                    v={`${data.cotacao.origem_cidade ?? "—"}/${data.cotacao.origem_uf ?? "—"} → ${data.cotacao.destino_cidade ?? "—"}/${data.cotacao.destino_uf ?? "—"}`}
                  />
                  <Linha k="Tabela de frete" v={data.cotacao.tabela_frete_nome ?? "Valores manuais"} />
                  <Linha k="Peso taxado" v={`${data.cotacao.peso_taxado} kg`} />
                  <Linha k="Prazo" v={`${data.cotacao.prazo_dias} dia(s)`} />
                  <Linha k="Total cotado" v={brl(data.cotacao.valor_total)} />
                </Bloco>
              )}

              <Bloco titulo="Linha do tempo">
                {data.historico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem movimentações.</p>
                ) : (
                  data.historico.map((h: any) => (
                    <div key={h.id} className="text-sm border-l-2 pl-3 py-1">
                      <p className="font-medium">
                        {STATUS_PROPOSTA.find((s) => s.value === h.status_novo)?.label ?? h.status_novo}
                      </p>
                      <p className="text-xs text-muted-foreground">{dt(h.created_at)}{h.observacao ? ` · ${h.observacao}` : ""}</p>
                    </div>
                  ))
                )}
              </Bloco>
            </div>
          </>
        )}
      </div>
    </PxSalesShell>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-1.5">
      <p className="text-xs font-medium uppercase text-muted-foreground mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
