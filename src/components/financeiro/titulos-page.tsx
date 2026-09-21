import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { FinShell, FinKpi, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarCadastros } from "@/lib/financeiro.functions";
import {
  finListarPagar, finListarReceber, finSalvarPagar, finSalvarReceber,
  finPagar, finReceber, finCancelarTitulo, finHistoricoTitulo, finMarcarVencidos,
} from "@/lib/financeiro-titulos.functions";

type Modo = "pagar" | "receber";

const STATUS_PAGAR = ["previsto", "aberto", "parcialmente_pago", "pago", "vencido", "cancelado"];
const STATUS_RECEBER = ["previsto", "aberto", "parcialmente_recebido", "recebido", "vencido", "cancelado"];

export function TitulosPage({ modo }: { modo: Modo }) {
  const pagar = modo === "pagar";
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();

  const [status, setStatus] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<any | null>(null);
  const [baixa, setBaixa] = useState<any | null>(null);
  const [detalhe, setDetalhe] = useState<any | null>(null);

  const listar = useServerFn(pagar ? finListarPagar : finListarReceber);
  const salvar = useServerFn(pagar ? finSalvarPagar : finSalvarReceber);
  const baixar = useServerFn(pagar ? finPagar : finReceber);
  const cancelar = useServerFn(finCancelarTitulo);
  const historico = useServerFn(finHistoricoTitulo);
  const vencidos = useServerFn(finMarcarVencidos);
  const cadastros = useServerFn(finListarCadastros);

  const filtros = { empresaId: empresa?.id ?? null, status: status || null, de: de || null, ate: ate || null, busca: busca || null };
  const key = ["fin-titulos", modo, filtros];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => listar({ data: filtros }) });
  const { data: cad } = useQuery({
    queryKey: ["fin-cadastros", empresa?.id ?? null],
    queryFn: () => cadastros({ data: { empresaId: empresa?.id ?? null } }),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["fin-titulos", modo] });

  const mSalvar = useMutation({
    mutationFn: (v: any) => salvar({ data: { id: v.id ?? null, empresaId: empresa?.id ?? null, payload: v.payload } }),
    onSuccess: () => { toast.success("Título salvo"); setForm(null); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const mBaixa = useMutation({
    mutationFn: (v: any) => baixar({ data: v }),
    onSuccess: (r: any) => {
      toast[r?.repetido ? "info" : "success"](r?.repetido ? "Lançamento já registrado" : "Baixa registrada");
      setBaixa(null); invalidar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mCancelar = useMutation({
    mutationFn: (v: { id: string; motivo: string }) =>
      cancelar({ data: { entidade: pagar ? "conta_pagar" : "conta_receber", id: v.id, motivo: v.motivo } }),
    onSuccess: () => { toast.success("Título cancelado"); setDetalhe(null); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: hist } = useQuery({
    queryKey: ["fin-hist", modo, detalhe?.id],
    queryFn: () => historico({ data: { entidade: pagar ? "conta_pagar" : "conta_receber", id: detalhe.id } }),
    enabled: !!detalhe?.id,
  });

  const rows = (data?.rows ?? []) as any[];
  const totais = data?.totais ?? { aberto: 0, vencido: 0, hoje: 0 };
  const valorPagoCampo = pagar ? "valor_pago" : "valor_recebido";
  const statusLista = pagar ? STATUS_PAGAR : STATUS_RECEBER;
  const saldo = (r: any) => Number(r.valor ?? 0) - Number(r[valorPagoCampo] ?? 0);
  const idemBase = useMemo(() => Math.random().toString(36).slice(2), [baixa?.id]);

  return (
    <FinShell
      title={pagar ? "Contas a pagar" : "Contas a receber"}
      subtitle="Movimentação financeira"
      actions={
        <button onClick={() => setForm({ payload: { vencimento: new Date().toISOString().slice(0, 10), status: "aberto" } })}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">
          <Plus className="size-3.5" /> Novo
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-1.5 rounded-md bg-surface/60 ring-1 ring-border">
          <option value="">Todos os status</option>
          {statusLista.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="px-2 py-1.5 rounded-md bg-surface/60 ring-1 ring-border" />
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="px-2 py-1.5 rounded-md bg-surface/60 ring-1 ring-border" />
        <input placeholder="Buscar descrição" value={busca} onChange={(e) => setBusca(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-surface/60 ring-1 ring-border min-w-40" />
        <button onClick={() => vencidos({ data: { empresaId: empresa?.id ?? null } }).then(() => invalidar())}
          className="px-2 py-1.5 rounded-md ring-1 ring-border text-muted-foreground hover:text-foreground">
          Atualizar vencidos
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FinKpi label="Total em aberto" value={brl(totais.aberto)} />
        <FinKpi label="Vencendo hoje" value={brl(totais.hoje)} tone="ambar" />
        <FinKpi label="Vencido" value={brl(totais.vencido)} tone="vermelho" />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">{pagar ? "Fornecedor" : "Cliente"}</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2">Vencimento</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2">Saldo</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={7} className="p-6 text-center text-rose-300">{(error as Error).message}</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum título encontrado.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 hover:bg-white/5 cursor-pointer" onClick={() => setDetalhe(r)}>
                <td className="p-2">{(pagar ? r.fornecedor_nome : r.cliente_nome) ?? "—"}</td>
                <td className="p-2">{r.descricao}</td>
                <td className="p-2">{dataBr(r.vencimento)}</td>
                <td className="p-2 text-right tabular-nums">{brl(r.valor)}</td>
                <td className="p-2 text-right tabular-nums">{brl(saldo(r))}</td>
                <td className="p-2"><FinStatus status={r.status} /></td>
                <td className="p-2 text-right">
                  {!["cancelado", pagar ? "pago" : "recebido"].includes(r.status) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBaixa({ ...r, valorBaixa: saldo(r) }); }}
                      className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">
                      {pagar ? "Pagar" : "Receber"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulário */}
      {form && (
        <Drawer titulo={form.id ? "Editar título" : "Novo título"} onClose={() => setForm(null)}>
          <div className="grid gap-2 text-xs">
            <Campo label={pagar ? "Fornecedor" : "Cliente"}>
              <input className="input" value={(pagar ? form.payload.fornecedor_nome : form.payload.cliente_nome) ?? ""}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, [pagar ? "fornecedor_nome" : "cliente_nome"]: e.target.value } })} />
            </Campo>
            <Campo label="Descrição">
              <input className="input" value={form.payload.descricao ?? ""}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, descricao: e.target.value } })} />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Valor">
                <input className="input" type="number" step="0.01" value={form.payload.valor ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, valor: Number(e.target.value) } })} />
              </Campo>
              <Campo label="Vencimento">
                <input className="input" type="date" value={form.payload.vencimento ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, vencimento: e.target.value } })} />
              </Campo>
              <Campo label="Competência">
                <input className="input" type="date" value={form.payload.competencia ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, competencia: e.target.value } })} />
              </Campo>
              <Campo label="Status">
                <select className="input" value={form.payload.status ?? "aberto"}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, status: e.target.value } })}>
                  <option value="previsto">previsto</option>
                  <option value="aberto">aberto</option>
                </select>
              </Campo>
              <Campo label="Categoria">
                <select className="input" value={form.payload.categoria_id ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, categoria_id: e.target.value || null } })}>
                  <option value="">—</option>
                  {(cad?.categorias ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Centro de custo">
                <select className="input" value={form.payload.centro_custo_id ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, centro_custo_id: e.target.value || null } })}>
                  <option value="">—</option>
                  {(cad?.centros ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Conta financeira">
                <select className="input" value={form.payload.conta_id ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, conta_id: e.target.value || null } })}>
                  <option value="">—</option>
                  {(cad?.contas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Documento">
                <input className="input" value={form.payload.documento ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, documento: e.target.value } })} />
              </Campo>
            </div>
            <Campo label="Observação">
              <textarea className="input" rows={2} value={form.payload.observacao ?? ""}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, observacao: e.target.value } })} />
            </Campo>
            <button disabled={mSalvar.isPending} onClick={() => mSalvar.mutate(form)}
              className="mt-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50">
              {mSalvar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </Drawer>
      )}

      {/* Baixa */}
      {baixa && (
        <Drawer titulo={pagar ? "Registrar pagamento" : "Registrar recebimento"} onClose={() => setBaixa(null)}>
          <div className="grid gap-2 text-xs">
            <div className="text-muted-foreground">{baixa.descricao} — saldo {brl(saldo(baixa))}</div>
            <Campo label="Valor">
              <input className="input" type="number" step="0.01" value={baixa.valorBaixa ?? ""}
                onChange={(e) => setBaixa({ ...baixa, valorBaixa: Number(e.target.value) })} />
            </Campo>
            <Campo label="Data">
              <input className="input" type="date" value={baixa.dataBaixa ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBaixa({ ...baixa, dataBaixa: e.target.value })} />
            </Campo>
            <Campo label="Conta financeira">
              <select className="input" value={baixa.contaId ?? baixa.conta_id ?? ""}
                onChange={(e) => setBaixa({ ...baixa, contaId: e.target.value || null })}>
                <option value="">—</option>
                {(cad?.contas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Forma">
              <input className="input" value={baixa.forma ?? ""} onChange={(e) => setBaixa({ ...baixa, forma: e.target.value })} />
            </Campo>
            <button disabled={mBaixa.isPending}
              onClick={() => mBaixa.mutate({
                id: baixa.id, valor: Number(baixa.valorBaixa),
                data: baixa.dataBaixa ?? new Date().toISOString().slice(0, 10),
                contaId: baixa.contaId ?? baixa.conta_id ?? null, forma: baixa.forma ?? null,
                idempotencyKey: `${modo}:${baixa.id}:${idemBase}`,
              })}
              className="mt-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50">
              {mBaixa.isPending ? "Registrando…" : "Confirmar"}
            </button>
          </div>
        </Drawer>
      )}

      {/* Detalhe + histórico */}
      {detalhe && (
        <Drawer titulo={detalhe.descricao} onClose={() => setDetalhe(null)}>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Info label="Valor" value={brl(detalhe.valor)} />
              <Info label={pagar ? "Pago" : "Recebido"} value={brl(detalhe[valorPagoCampo])} />
              <Info label="Vencimento" value={dataBr(detalhe.vencimento)} />
              <Info label="Status" value={detalhe.status.replace(/_/g, " ")} />
              <Info label="Origem" value={detalhe.origem} />
              <Info label="Documento" value={detalhe.documento ?? "—"} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setForm({ id: detalhe.id, payload: { ...detalhe } }); setDetalhe(null); }}
                className="px-2.5 py-1.5 rounded-md ring-1 ring-border">Editar</button>
              {!["cancelado", pagar ? "pago" : "recebido"].includes(detalhe.status) && (
                <button onClick={() => {
                  const motivo = window.prompt("Motivo do cancelamento:");
                  if (motivo) mCancelar.mutate({ id: detalhe.id, motivo });
                }} className="px-2.5 py-1.5 rounded-md ring-1 ring-rose-500/40 text-rose-300">Cancelar título</button>
              )}
            </div>
            <div className="pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Histórico</div>
              {(hist ?? []).length === 0 ? (
                <div className="text-muted-foreground">Sem alterações registradas.</div>
              ) : (hist ?? []).map((h: any) => (
                <div key={h.id} className="border-b border-border/40 py-1.5">
                  <div className="flex justify-between">
                    <span>{h.acao}</span>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {h.para && <div className="text-muted-foreground break-all">{JSON.stringify(h.para)}</div>}
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </FinShell>
  );
}

function Drawer({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:w-[420px] max-w-full h-full overflow-y-auto thin-scroll border-l border-border p-4" style={{ background: "#0f0f12" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold truncate">{titulo}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}
