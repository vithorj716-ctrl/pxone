import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileSignature, Trash2, Pencil } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { CotacaoDialog } from "@/components/pxsales/cotacao-dialog";
import { Button } from "@/components/ui/button";
import { getCotacao, setStatusCotacao, excluirCotacao, gerarPropostaDaCotacao } from "@/lib/pxsales-cotacoes.functions";
import { STATUS_COTACAO } from "@/pxsales/frete-calc";

export const Route = createFileRoute("/_authenticated/sales/cotacoes/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Cotação | Grupo PX" },
      { name: "description", content: "Detalhe da cotação de frete, composição de valores, validade e geração da proposta." },
      { property: "og:title", content: "PXSales — Cotação" },
      { property: "og:description", content: "Detalhe da cotação de frete." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotacaoDetalhe,
});

const brl = (v: any) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CotacaoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editar, setEditar] = useState(false);

  const fnGet = useServerFn(getCotacao);
  const fnStatus = useServerFn(setStatusCotacao);
  const fnExcluir = useServerFn(excluirCotacao);
  const fnProposta = useServerFn(gerarPropostaDaCotacao);

  const { data, isLoading } = useQuery({
    queryKey: ["pxsales", "cotacao", id],
    queryFn: () => fnGet({ data: { id } }),
  });

  const c = data?.cotacao;

  async function mudarStatus(status: string) {
    await fnStatus({ data: { id, status } });
    toast.success("Situação atualizada");
    void qc.invalidateQueries({ queryKey: ["pxsales", "cotacao", id] });
    void qc.invalidateQueries({ queryKey: ["pxsales", "cotacoes"] });
  }

  async function gerarProposta() {
    try {
      const r = await fnProposta({ data: { cotacao_id: id } });
      toast.success("Proposta gerada");
      void qc.invalidateQueries({ queryKey: ["pxsales", "propostas"] });
      void navigate({ to: "/sales/propostas/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar a proposta");
    }
  }

  async function remover() {
    if (!confirm("Excluir esta cotação?")) return;
    await fnExcluir({ data: { id } });
    toast.success("Cotação excluída");
    void qc.invalidateQueries({ queryKey: ["pxsales", "cotacoes"] });
    void navigate({ to: "/sales/cotacoes" });
  }

  return (
    <PxSalesShell title="Cotação" subtitle={c ? `nº ${c.numero}` : id}>
      <div className="space-y-4">
        <Link to="/sales/cotacoes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar para cotações
        </Link>

        {isLoading || !c ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{c.empresa_nome}</h2>
                  <p className="text-sm text-muted-foreground">
                    {(c.origem_cidade ?? "—")}/{c.origem_uf ?? "—"} → {(c.destino_cidade ?? "—")}/{c.destino_uf ?? "—"} · {c.tipo_operacao} · prazo {c.prazo_dias} dia(s)
                  </p>
                  {c.tabela_frete_nome && <p className="text-xs text-muted-foreground mt-1">Tabela de frete: {c.tabela_frete_nome}</p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{brl(c.valor_total)}</p>
                  <select
                    className="mt-2 h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={c.status}
                    onChange={(e) => void mudarStatus(e.target.value)}
                  >
                    {STATUS_COTACAO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={gerarProposta}><FileSignature className="size-4 mr-1.5" /> Gerar proposta</Button>
                <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="size-4 mr-1.5" /> Editar</Button>
                <Button variant="ghost" className="text-red-600" onClick={remover}><Trash2 className="size-4 mr-1.5" /> Excluir</Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Bloco titulo="Carga">
                <Linha k="Volumes" v={String(c.qtd_volumes)} />
                <Linha k="Peso" v={`${c.peso} kg`} />
                <Linha k="Cubagem" v={`${c.cubagem} m³`} />
                <Linha k="Peso cubado" v={`${c.peso_cubado} kg`} />
                <Linha k="Peso taxado" v={`${c.peso_taxado} kg`} />
                <Linha k="Mercadoria" v={`${c.tipo_mercadoria ?? "—"} · ${brl(c.valor_mercadoria)}`} />
              </Bloco>
              <Bloco titulo="Composição do valor">
                <Linha k="Frete base" v={brl(c.valor_base)} />
                <Linha k="Coleta" v={brl(c.valor_coleta)} />
                <Linha k="Entrega" v={brl(c.valor_entrega)} />
                <Linha k="Pedágio" v={brl(c.pedagio)} />
                <Linha k={`GRIS (${c.gris_percentual}%)`} v={brl((Number(c.valor_mercadoria) * Number(c.gris_percentual)) / 100)} />
                <Linha k={`Ad-valorem (${c.advalorem_percentual}%)`} v={brl((Number(c.valor_mercadoria) * Number(c.advalorem_percentual)) / 100)} />
                <Linha k="Taxas extras" v={brl(c.taxas_extras)} />
                <Linha k={`Desconto (${c.desconto_percentual}%)`} v={`- ${brl((Number(c.valor_total) * Number(c.desconto_percentual)) / 100)}`} />
                <Linha k="Total" v={brl(c.valor_total)} destaque />
              </Bloco>
              <Bloco titulo="Comercial">
                <Linha k="Contato" v={c.contato_nome ?? "—"} />
                <Linha k="E-mail" v={c.contato_email ?? "—"} />
                <Linha k="Embarques/mês" v={c.frequencia_mensal ? String(c.frequencia_mensal) : "—"} />
                <Linha k="Pagamento" v={c.condicao_pagamento ?? "—"} />
                <Linha k="Validade" v={c.validade_ate ? new Date(`${c.validade_ate}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
              </Bloco>
              <Bloco titulo="Propostas geradas">
                {data.propostas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma proposta gerada a partir desta cotação.</p>
                ) : (
                  data.propostas.map((p) => (
                    <Link key={p.id} to="/sales/propostas/$id" params={{ id: p.id }} className="block text-sm hover:underline">
                      nº {p.numero} — {p.titulo} · {brl(p.valor_total)} · {p.status}
                    </Link>
                  ))
                )}
              </Bloco>
            </div>

            {c.observacoes && (
              <Bloco titulo="Observações">
                <p className="text-sm whitespace-pre-wrap">{c.observacoes}</p>
              </Bloco>
            )}
          </>
        )}
      </div>

      <CotacaoDialog
        open={editar}
        onOpenChange={setEditar}
        cotacao={c ?? null}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["pxsales", "cotacao", id] })}
      />
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

function Linha({ k, v, destaque }: { k: string; v: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${destaque ? "font-semibold border-t pt-1.5 mt-1.5" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
