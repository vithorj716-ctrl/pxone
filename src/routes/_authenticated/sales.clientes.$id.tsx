import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Loader2, Mail, MapPin, MessageCircle, Phone, Truck, Wallet,
} from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { getSalesCliente360 } from "@/lib/pxsales-clientes.functions";
import { formatCnpj, onlyDigits } from "@/lib/cnpj";
import { SETORES_CONTATO, TIPOS_ENDERECO } from "@/lib/px-enderecos.functions";

export const Route = createFileRoute("/_authenticated/sales/clientes/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Ficha do cliente | Grupo PX" },
      { name: "description", content: "Visão 360º do cliente: cadastro, contatos, endereços, operação e financeiro." },
      { property: "og:title", content: "PXSales — Ficha do cliente" },
      { property: "og:description", content: "Visão 360º comercial e operacional do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClienteDetalhe,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Cliente não encontrado.</div>,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

const ABAS = [
  { key: "dados", label: "Dados" },
  { key: "contatos", label: "Contatos" },
  { key: "enderecos", label: "Endereços" },
  { key: "operacao", label: "Operação" },
  { key: "financeiro", label: "Financeiro" },
  { key: "tabelas", label: "Tabelas" },
  { key: "historico", label: "Histórico" },
] as const;

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5 break-words">{value || "—"}</div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="rounded-xl ring-1 ring-border bg-surface/30 p-8 text-center text-xs text-muted-foreground">{texto}</div>;
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const [aba, setAba] = useState<string>("dados");
  const fn = useServerFn(getSalesCliente360);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pxsales", "cliente", id],
    queryFn: () => fn({ data: { id } }),
  });

  const c = data?.cliente;
  const titulo = c?.nome_fantasia || c?.razao_social || "Cliente";

  return (
    <PxSalesShell title={titulo} subtitle="Visão 360º do cliente">
      <Link to="/sales/clientes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Voltar para a carteira
      </Link>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando ficha do cliente…
        </div>
      ) : error || !data || !c ? (
        <Vazio texto={(error as any)?.message ?? "Cliente não encontrado."} />
      ) : (
        <>
          <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                  <h2 className="text-base font-semibold truncate">{c.razao_social || titulo}</h2>
                  {c.ativo === false && (
                    <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Inativo</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCnpj(c.cnpj)}
                  {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ""}` : ""}
                  {c.situacao_cadastral ? ` · ${c.situacao_cadastral}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.telefone && (
                  <a href={`tel:${onlyDigits(c.telefone)}`} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60">
                    <Phone className="size-3" /> Ligar
                  </a>
                )}
                {c.whatsapp && (
                  <a href={`https://wa.me/55${onlyDigits(c.whatsapp)}`} target="_blank" rel="noreferrer" className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60">
                    <MessageCircle className="size-3" /> WhatsApp
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-border hover:bg-surface/60">
                    <Mail className="size-3" /> E-mail
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
              <Campo label="Embarques" value={String(data.resumo.minutas)} />
              <Campo label="Valor em fretes" value={brl(data.resumo.valor_total)} />
              <Campo label="Ticket médio" value={brl(data.resumo.ticket_medio)} />
              <Campo label="Último embarque" value={dt(data.resumo.ultima_minuta)} />
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto mt-4 pb-1">
            {ABAS.map((a) => (
              <button
                key={a.key}
                onClick={() => setAba(a.key)}
                className={`px-3 h-8 rounded-md text-xs whitespace-nowrap transition ${aba === a.key ? "bg-surface text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {aba === "dados" && (
              <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 sm:p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Campo label="Razão social" value={c.razao_social} />
                <Campo label="Nome fantasia" value={c.nome_fantasia} />
                <Campo label="CNPJ" value={formatCnpj(c.cnpj)} />
                <Campo label="Abertura" value={dt(c.data_abertura)} />
                <Campo label="Natureza jurídica" value={c.natureza_juridica} />
                <Campo label="CNAE" value={[c.cnae_principal, c.cnae_descricao].filter(Boolean).join(" — ")} />
                <Campo label="Endereço" value={[c.logradouro, c.numero, c.bairro].filter(Boolean).join(", ")} />
                <Campo label="Cidade/UF" value={[c.cidade, c.uf].filter(Boolean).join("/")} />
                <Campo label="CEP" value={c.cep} />
                <Campo label="Condição de pagamento" value={c.condicao_pagamento} />
                <Campo label="Prazo padrão" value={c.prazo_padrao_dias ? `${c.prazo_padrao_dias} dias` : null} />
                <Campo label="Limite de crédito" value={c.limite_credito != null ? brl(Number(c.limite_credito)) : null} />
                <Campo label="Categorias" value={(c.categorias ?? []).join(", ")} />
                <Campo label="Sistemas vinculados" value={(data.vinculos ?? []).map((v: any) => v.sistema_key).join(", ")} />
                <Campo label="Observações comerciais" value={c.observacoes_comerciais} />
              </div>
            )}

            {aba === "contatos" && (
              data.contatos.length === 0 ? <Vazio texto="Nenhum contato cadastrado para esta empresa." /> : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.contatos.map((ct: any) => (
                    <div key={ct.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{ct.nome}</div>
                        {ct.is_principal && <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-brand/15">Principal</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[ct.cargo, SETORES_CONTATO.find((s) => s.value === ct.setor)?.label ?? ct.setor].filter(Boolean).join(" · ")}
                      </div>
                      <div className="text-[11px] mt-2 space-y-0.5">
                        {ct.telefone && <div>{ct.telefone}</div>}
                        {ct.whatsapp && <div>WhatsApp: {ct.whatsapp}</div>}
                        {ct.email && <div className="truncate">{ct.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {aba === "enderecos" && (
              data.enderecos.length === 0 ? <Vazio texto="Nenhum endereço cadastrado para esta empresa." /> : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.enderecos.map((e: any) => (
                    <div key={e.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {e.apelido || TIPOS_ENDERECO.find((t) => t.value === e.tipo)?.label || e.tipo}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {[e.logradouro, e.numero, e.complemento, e.bairro].filter(Boolean).join(", ")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {[e.cidade, e.uf].filter(Boolean).join("/")} {e.cep ? `· ${e.cep}` : ""}
                      </div>
                      {e.janela_recebimento && (
                        <div className="text-[11px] mt-1.5">Janela: {e.janela_recebimento}</div>
                      )}
                      {(e.restricoes ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.restricoes.map((r: string) => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-surface ring-1 ring-border">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {aba === "operacao" && (
              data.minutas.length === 0 ? <Vazio texto="Este cliente ainda não possui embarques registrados no PXLog." /> : (
                <div className="rounded-xl ring-1 ring-border bg-surface/30 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left font-medium p-2.5">Minuta</th>
                        <th className="text-left font-medium p-2.5">Trecho</th>
                        <th className="text-left font-medium p-2.5">Status</th>
                        <th className="text-right font-medium p-2.5">Volumes</th>
                        <th className="text-right font-medium p-2.5">Frete</th>
                        <th className="text-right font-medium p-2.5">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.minutas.map((m: any) => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0">
                          <td className="p-2.5 font-medium">#{m.numero}</td>
                          <td className="p-2.5 text-muted-foreground">{m.origem} → {m.destino}</td>
                          <td className="p-2.5">{m.status}</td>
                          <td className="p-2.5 text-right">{m.qtd_volumes}</td>
                          <td className="p-2.5 text-right">{brl(Number(m.valor_frete ?? 0))}</td>
                          <td className="p-2.5 text-right text-muted-foreground">{dt(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {aba === "financeiro" && (
              <div className="space-y-3">
                <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Campo label="Limite de crédito" value={brl(Number(data.saldo?.limite_credito ?? data.credito?.limite_credito ?? 0))} />
                  <Campo label="Utilizado" value={brl(Number(data.saldo?.utilizado ?? 0))} />
                  <Campo label="Vencido" value={brl(Number(data.saldo?.vencido ?? 0))} />
                  <Campo label="Disponível" value={brl(Number(data.saldo?.disponivel ?? 0))} />
                  {data.credito?.bloqueado && (
                    <div className="col-span-2 lg:col-span-4 text-xs text-destructive flex items-center gap-1.5">
                      <Wallet className="size-3.5" /> Cliente bloqueado{data.credito.motivo_bloqueio ? `: ${data.credito.motivo_bloqueio}` : ""}
                    </div>
                  )}
                </div>
                {data.lancamentos.length === 0 ? (
                  <Vazio texto="Nenhum lançamento em conta corrente." />
                ) : (
                  <div className="rounded-xl ring-1 ring-border bg-surface/30 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="text-left font-medium p-2.5">Descrição</th>
                          <th className="text-left font-medium p-2.5">Tipo</th>
                          <th className="text-left font-medium p-2.5">Status</th>
                          <th className="text-right font-medium p-2.5">Vencimento</th>
                          <th className="text-right font-medium p-2.5">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lancamentos.map((l: any) => (
                          <tr key={l.id} className="border-b border-border/50 last:border-0">
                            <td className="p-2.5">{l.descricao}</td>
                            <td className="p-2.5 text-muted-foreground">{l.tipo}</td>
                            <td className="p-2.5">{l.status}</td>
                            <td className="p-2.5 text-right text-muted-foreground">{dt(l.vencimento)}</td>
                            <td className="p-2.5 text-right">{brl(Number(l.valor ?? 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {aba === "tabelas" && (
              data.tabelas.length === 0 ? <Vazio texto="Nenhuma tabela de frete específica para este cliente." /> : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.tabelas.map((t: any) => (
                    <div key={t.id} className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Truck className="size-3.5 text-muted-foreground" /> {t.nome}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {[t.origem, t.destino].filter(Boolean).join(" → ") || "Trecho livre"} · {t.tipo_cobranca}
                      </div>
                      <div className="text-[11px] mt-1.5">
                        Mínimo {brl(Number(t.valor_minimo ?? 0))} · prazo {t.prazo_dias} dia(s)
                        {t.ativo === false && <span className="text-destructive"> · inativa</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {aba === "historico" && (
              data.historico.length === 0 ? <Vazio texto="Nenhuma alteração registrada para este cliente." /> : (
                <div className="rounded-xl ring-1 ring-border bg-surface/30 divide-y divide-border">
                  {data.historico.map((h: any) => (
                    <div key={h.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{h.action}</span>
                        <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{h.user_label ?? "—"}</div>
                      {h.diff && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
                          {Object.entries(h.diff as Record<string, any>).slice(0, 8).map(([k, v]: any) => (
                            <div key={k}>
                              <span className="text-foreground">{k}</span>: {String(v?.from ?? "—")} → {String(v?.to ?? "—")}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </PxSalesShell>
  );
}
