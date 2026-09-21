import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import {
  finListarFolha, finSalvarPeriodoFolha, finSalvarItemFolha, finGerarPagamentosFolha,
} from "@/lib/financeiro-extras.functions";
import { finListarPessoas } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro/folha")({
  head: () => ({
    meta: [
      { title: "Folha de pagamentos — Financeiro PX" },
      { name: "description", content: "Períodos de pagamento de colaboradores e prestadores, com geração de títulos." },
      { property: "og:title", content: "Folha de pagamentos — Financeiro PX" },
      { property: "og:description", content: "Pagamentos periódicos da operação (sem encargos trabalhistas)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Folha,
});

function Folha() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState<any | null>(null);

  const listar = useServerFn(finListarFolha);
  const salvarPeriodo = useServerFn(finSalvarPeriodoFolha);
  const salvarItem = useServerFn(finSalvarItemFolha);
  const gerar = useServerFn(finGerarPagamentosFolha);
  const pessoasFn = useServerFn(finListarPessoas);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-folha", empresa?.id ?? null, periodoId],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null, periodoId } }),
  });
  const { data: pessoas } = useQuery({ queryKey: ["fin-pessoas-sel", empresa?.id ?? null], queryFn: () => pessoasFn({ data: { empresaId: empresa?.id ?? null } }) });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["fin-folha"] });

  const mPeriodo = useMutation({
    mutationFn: (p: any) => salvarPeriodo({ data: { empresaId: empresa?.id ?? null, payload: p } }),
    onSuccess: () => { toast.success("Período criado"); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mItem = useMutation({
    mutationFn: (p: any) => salvarItem({ data: { periodoId: periodoId!, empresaId: empresa?.id ?? null, payload: p } }),
    onSuccess: () => { toast.success("Item salvo"); setNovoItem(null); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mGerar = useMutation({
    mutationFn: () => gerar({ data: { periodoId: periodoId!, empresaId: empresa?.id ?? null } }),
    onSuccess: (r: any) => {
      toast.success(`${r.criados} pagamento(s) gerado(s)` + (r.existentes ? ` · ${r.existentes} já existia(m)` : ""));
      invalidar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const periodos = (data?.periodos ?? []) as any[];
  const itens = (data?.itens ?? []) as any[];

  function criarPeriodo() {
    const ref = window.prompt("Referência (ex.: 2026-03):");
    if (!ref) return;
    const inicio = window.prompt("Início (AAAA-MM-DD):");
    const fim = window.prompt("Fim (AAAA-MM-DD):");
    if (!inicio || !fim) return;
    mPeriodo.mutate({ referencia: ref, inicio, fim, status: "aberta" });
  }

  return (
    <FinShell
      title="Folha / Pagamentos"
      subtitle="Colaboradores e prestadores"
      actions={<button onClick={criarPeriodo} className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">Novo período</button>}
    >
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}
      <div className="flex flex-wrap gap-2 text-xs">
        <select className="input w-56" value={periodoId ?? ""} onChange={(e) => setPeriodoId(e.target.value || null)}>
          <option value="">Selecione o período</option>
          {periodos.map((p) => <option key={p.id} value={p.id}>{p.referencia} — {p.status}</option>)}
        </select>
        {periodoId && (
          <>
            <button onClick={() => setNovoItem({ pessoa_id: "", valor_base: 0 })} className="px-2.5 py-1.5 rounded-md ring-1 ring-border">Adicionar pessoa</button>
            <button onClick={() => mGerar.mutate()} disabled={mGerar.isPending} className="px-2.5 py-1.5 rounded-md bg-emerald-600 text-white disabled:opacity-50">
              Gerar pagamentos
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !periodoId ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/60 p-6 text-sm text-muted-foreground">
          Selecione ou crie um período para lançar os pagamentos.
        </div>
      ) : (
        <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left p-2">Pessoa</th>
                <th className="text-right p-2">Base</th>
                <th className="text-right p-2">Adicionais</th>
                <th className="text-right p-2">Descontos</th>
                <th className="text-right p-2">Adiantamentos</th>
                <th className="text-right p-2">Líquido</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum item lançado neste período.</td></tr>
              ) : itens.map((i) => (
                <tr key={i.id} className="border-b border-border/40">
                  <td className="p-2">{i.fin_pessoas?.nome ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{brl(i.valor_base)}</td>
                  <td className="p-2 text-right tabular-nums">{brl(i.adicionais)}</td>
                  <td className="p-2 text-right tabular-nums">{brl(i.descontos)}</td>
                  <td className="p-2 text-right tabular-nums">{brl(i.adiantamentos)}</td>
                  <td className="p-2 text-right tabular-nums font-medium">{brl(i.valor_liquido)}</td>
                  <td className="p-2"><FinStatus status={i.status ?? "aberto"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novoItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNovoItem(null)} />
          <div className="relative w-full sm:w-[380px] h-full overflow-y-auto thin-scroll border-l border-border p-4 space-y-2 text-xs" style={{ background: "#0f0f12" }}>
            <h2 className="text-sm font-semibold">Lançar pagamento</h2>
            <select className="input w-full" value={novoItem.pessoa_id}
              onChange={(e) => setNovoItem({ ...novoItem, pessoa_id: e.target.value })}>
              <option value="">Selecione a pessoa</option>
              {(pessoas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {["valor_base", "adicionais", "descontos", "adiantamentos", "ajustes"].map((c) => (
              <input key={c} className="input w-full" type="number" step="0.01" placeholder={c.replace("_", " ")}
                value={novoItem[c] ?? ""} onChange={(e) => setNovoItem({ ...novoItem, [c]: Number(e.target.value) })} />
            ))}
            <button disabled={mItem.isPending} onClick={() => mItem.mutate(novoItem)}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}
    </FinShell>
  );
}
