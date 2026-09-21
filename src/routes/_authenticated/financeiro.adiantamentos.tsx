import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { FinShell, FinStatus, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarAdiantamentos, finSalvarAdiantamento, finAcaoAdiantamento } from "@/lib/financeiro-extras.functions";
import { finListarPessoas, finListarCadastros } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro/adiantamentos")({
  head: () => ({
    meta: [
      { title: "Adiantamentos — Financeiro PX" },
      { name: "description", content: "Solicitação, aprovação, pagamento e acerto de adiantamentos." },
      { property: "og:title", content: "Adiantamentos — Financeiro PX" },
      { property: "og:description", content: "Controle de adiantamentos da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Adiantamentos,
});

function Adiantamentos() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<any | null>(null);

  const listar = useServerFn(finListarAdiantamentos);
  const salvar = useServerFn(finSalvarAdiantamento);
  const acao = useServerFn(finAcaoAdiantamento);
  const pessoasFn = useServerFn(finListarPessoas);
  const cadFn = useServerFn(finListarCadastros);

  const filtros = { empresaId: empresa?.id ?? null, status: status || null };
  const { data, isLoading, error } = useQuery({ queryKey: ["fin-adto", filtros], queryFn: () => listar({ data: filtros }) });
  const { data: pessoas } = useQuery({ queryKey: ["fin-pessoas-sel", empresa?.id ?? null], queryFn: () => pessoasFn({ data: { empresaId: empresa?.id ?? null } }) });
  const { data: cad } = useQuery({ queryKey: ["fin-cadastros", empresa?.id ?? null], queryFn: () => cadFn({ data: { empresaId: empresa?.id ?? null } }) });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["fin-adto"] });

  const mSalvar = useMutation({
    mutationFn: (v: any) => salvar({ data: { id: v.id ?? null, empresaId: empresa?.id ?? null, payload: v.payload } }),
    onSuccess: () => { toast.success("Adiantamento salvo"); setForm(null); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mAcao = useMutation({
    mutationFn: (v: any) => acao({ data: v }),
    onSuccess: () => { toast.success("Atualizado"); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as any[];

  return (
    <FinShell
      title="Adiantamentos"
      subtitle="Solicitação, aprovação, pagamento e acerto"
      actions={
        <button onClick={() => setForm({ payload: {} })} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">
          <Plus className="size-3.5" /> Novo
        </button>
      }
    >
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48 text-xs">
        <option value="">Todos os status</option>
        {["solicitado", "aprovado", "pago", "acertado", "cancelado"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Beneficiário</th>
              <th className="text-left p-2">Motivo</th>
              <th className="text-right p-2">Solicitado</th>
              <th className="text-right p-2">Aprovado</th>
              <th className="text-right p-2">Pago</th>
              <th className="text-right p-2">Acertado</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={8} className="p-6 text-center text-rose-300">{(error as Error).message}</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum adiantamento.</td></tr>
            ) : rows.map((a) => (
              <tr key={a.id} className="border-b border-border/40">
                <td className="p-2">{a.beneficiario_nome}</td>
                <td className="p-2">{a.motivo ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{brl(a.valor_solicitado)}</td>
                <td className="p-2 text-right tabular-nums">{brl(a.valor_aprovado)}</td>
                <td className="p-2 text-right tabular-nums">{brl(a.valor_pago)}</td>
                <td className="p-2 text-right tabular-nums">{brl(a.valor_acertado)}</td>
                <td className="p-2"><FinStatus status={a.status} /></td>
                <td className="p-2 text-right space-x-1 whitespace-nowrap">
                  {a.status === "solicitado" && (
                    <button onClick={() => mAcao.mutate({ id: a.id, acao: "aprovar", valor: Number(a.valor_solicitado) })}
                      className="text-[10px] px-2 py-1 rounded ring-1 ring-border">Aprovar</button>
                  )}
                  {a.status === "aprovado" && (
                    <button onClick={() => mAcao.mutate({ id: a.id, acao: "pagar", valor: Number(a.valor_aprovado ?? a.valor_solicitado), contaId: (cad?.contas ?? [])[0]?.id ?? null, idempotencyKey: `adto:${a.id}` })}
                      className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">Pagar</button>
                  )}
                  {a.status === "pago" && (
                    <button onClick={() => {
                      const v = window.prompt("Valor acertado:", String(a.valor_pago ?? 0));
                      if (v) mAcao.mutate({ id: a.id, acao: "acertar", valor: Number(v) });
                    }} className="text-[10px] px-2 py-1 rounded ring-1 ring-border">Acertar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setForm(null)} />
          <div className="relative w-full sm:w-[400px] h-full overflow-y-auto thin-scroll border-l border-border p-4 space-y-2 text-xs" style={{ background: "#0f0f12" }}>
            <h2 className="text-sm font-semibold">Novo adiantamento</h2>
            <select className="input w-full" value={form.payload.pessoa_id ?? ""}
              onChange={(e) => {
                const p = (pessoas ?? []).find((x: any) => x.id === e.target.value);
                setForm({ ...form, payload: { ...form.payload, pessoa_id: e.target.value || null, beneficiario_nome: p?.nome ?? form.payload.beneficiario_nome } });
              }}>
              <option value="">Beneficiário cadastrado (opcional)</option>
              {(pessoas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input className="input w-full" placeholder="Nome do beneficiário" value={form.payload.beneficiario_nome ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, beneficiario_nome: e.target.value } })} />
            <input className="input w-full" type="number" step="0.01" placeholder="Valor solicitado" value={form.payload.valor_solicitado ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, valor_solicitado: Number(e.target.value) } })} />
            <input className="input w-full" placeholder="Motivo" value={form.payload.motivo ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, motivo: e.target.value } })} />
            <input className="input w-full" type="date" value={form.payload.previsao_acerto ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, previsao_acerto: e.target.value || null } })} />
            <button disabled={mSalvar.isPending} onClick={() => mSalvar.mutate(form)}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}
    </FinShell>
  );
}
