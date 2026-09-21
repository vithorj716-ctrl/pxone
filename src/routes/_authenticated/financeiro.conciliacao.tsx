import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarConciliacao, finSalvarConciliacao } from "@/lib/financeiro-extras.functions";
import { finListarCadastros } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro/conciliacao")({
  head: () => ({
    meta: [
      { title: "Conciliação — Financeiro PX" },
      { name: "description", content: "Conferência manual de extratos contra os movimentos financeiros." },
      { property: "og:title", content: "Conciliação — Financeiro PX" },
      { property: "og:description", content: "Conciliação financeira da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conciliacao,
});

function Conciliacao() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [form, setForm] = useState<any | null>(null);

  const listar = useServerFn(finListarConciliacao);
  const salvar = useServerFn(finSalvarConciliacao);
  const cadFn = useServerFn(finListarCadastros);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-conc", empresa?.id ?? null],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null } }),
  });
  const { data: cad } = useQuery({ queryKey: ["fin-cadastros", empresa?.id ?? null], queryFn: () => cadFn({ data: { empresaId: empresa?.id ?? null } }) });

  const mSalvar = useMutation({
    mutationFn: (v: any) => salvar({ data: { id: v.id ?? null, empresaId: empresa?.id ?? null, payload: v.payload } }),
    onSuccess: () => { toast.success("Conciliação salva"); setForm(null); qc.invalidateQueries({ queryKey: ["fin-conc"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as any[];
  const movimentos = (data?.movimentos ?? []) as any[];

  return (
    <FinShell
      title="Conciliação"
      subtitle="Extrato x movimentos"
      actions={
        <button onClick={() => setForm({ payload: { data: new Date().toISOString().slice(0, 10), status: "nao_conciliado" } })}
          className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">Novo lançamento</button>
      }
    >
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}
      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Valor extrato</th>
              <th className="text-left p-2">Movimento vinculado</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum lançamento de conciliação.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 hover:bg-white/5 cursor-pointer" onClick={() => setForm({ id: r.id, payload: { ...r } })}>
                <td className="p-2">{dataBr(r.data)}</td>
                <td className="p-2">{r.descricao ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{brl(r.valor)}</td>
                <td className="p-2">{r.movimento_id ? r.movimento_id.slice(0, 8) : "—"}</td>
                <td className="p-2"><FinStatus status={r.status ?? "nao_conciliado"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setForm(null)} />
          <div className="relative w-full sm:w-[400px] h-full overflow-y-auto thin-scroll border-l border-border p-4 space-y-2 text-xs" style={{ background: "#0f0f12" }}>
            <h2 className="text-sm font-semibold">Lançamento de conciliação</h2>
            <select className="input w-full" value={form.payload.conta_id ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, conta_id: e.target.value || null } })}>
              <option value="">Conta financeira</option>
              {(cad?.contas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input className="input w-full" type="date" value={form.payload.data ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, data: e.target.value } })} />
            <input className="input w-full" placeholder="Descrição do extrato" value={form.payload.descricao ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, descricao: e.target.value } })} />
            <input className="input w-full" type="number" step="0.01" placeholder="Valor" value={form.payload.valor ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, valor: Number(e.target.value) } })} />
            <select className="input w-full" value={form.payload.movimento_id ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, movimento_id: e.target.value || null } })}>
              <option value="">Vincular movimento (opcional)</option>
              {movimentos.map((m: any) => (
                <option key={m.id} value={m.id}>{dataBr(m.data)} — {m.tipo} — {brl(m.valor)}</option>
              ))}
            </select>
            <select className="input w-full" value={form.payload.status ?? "nao_conciliado"}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, status: e.target.value } })}>
              {["nao_conciliado", "conciliado", "divergente", "ignorado"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button disabled={mSalvar.isPending} onClick={() => mSalvar.mutate(form)}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}
    </FinShell>
  );
}
