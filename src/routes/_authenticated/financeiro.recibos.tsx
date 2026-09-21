import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarRecibos, finEmitirRecibo } from "@/lib/financeiro-extras.functions";

export const Route = createFileRoute("/_authenticated/financeiro/recibos")({
  head: () => ({
    meta: [
      { title: "Recibos — Financeiro PX" },
      { name: "description", content: "Emissão e reemissão de recibos numerados de pagamento e recebimento." },
      { property: "og:title", content: "Recibos — Financeiro PX" },
      { property: "og:description", content: "Documentos de recibo da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recibos,
});

function Recibos() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [form, setForm] = useState<any | null>(null);

  const listar = useServerFn(finListarRecibos);
  const emitir = useServerFn(finEmitirRecibo);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-recibos", empresa?.id ?? null],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null } }),
  });

  const mEmitir = useMutation({
    mutationFn: (v: any) => emitir({ data: { ...v, empresaId: empresa?.id ?? null } }),
    onSuccess: () => { toast.success("Recibo emitido"); setForm(null); qc.invalidateQueries({ queryKey: ["fin-recibos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as any[];

  return (
    <FinShell
      title="Recibos"
      subtitle="Emissão e reemissão"
      actions={
        <button onClick={() => setForm({ tipo: "pagamento", data: new Date().toISOString().slice(0, 10) })}
          className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">Emitir recibo</button>
      }
    >
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}
      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Número</th>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Beneficiário</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum recibo emitido.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="p-2">{r.numero}</td>
                <td className="p-2">{dataBr(r.data)}</td>
                <td className="p-2">{r.beneficiario_nome}</td>
                <td className="p-2">{r.descricao}</td>
                <td className="p-2 text-right tabular-nums">{brl(r.valor)}</td>
                <td className="p-2 text-right">
                  <button className="text-[10px] px-2 py-1 rounded ring-1 ring-border"
                    onClick={() => setForm({
                      tipo: r.tipo, beneficiario: r.beneficiario_nome, documento: r.beneficiario_documento,
                      descricao: r.descricao, valor: Number(r.valor), data: new Date().toISOString().slice(0, 10),
                      forma: r.forma_pagamento, movimentoId: r.movimento_id ?? null,
                      justificativa: "Reemissão de via do recibo nº " + r.numero,
                      reemissaoDe: r.id,
                    })}>Reemitir</button>
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
            <h2 className="text-sm font-semibold">{form.reemissaoDe ? "Reemitir recibo" : "Emitir recibo"}</h2>
            <select className="input w-full" value={form.tipo ?? "pagamento"} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {["pagamento", "recebimento", "adiantamento", "acerto", "comissao", "folha", "prestacao_servico", "outro"]
                .map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input w-full" placeholder="Beneficiário" value={form.beneficiario ?? ""}
              onChange={(e) => setForm({ ...form, beneficiario: e.target.value })} />
            <input className="input w-full" placeholder="Documento" value={form.documento ?? ""}
              onChange={(e) => setForm({ ...form, documento: e.target.value })} />
            <input className="input w-full" placeholder="Descrição" value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <input className="input w-full" type="number" step="0.01" placeholder="Valor" value={form.valor ?? ""}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            <input className="input w-full" type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <input className="input w-full" placeholder="Forma de pagamento" value={form.forma ?? ""}
              onChange={(e) => setForm({ ...form, forma: e.target.value })} />
            <button disabled={mEmitir.isPending} onClick={() => mEmitir.mutate(form)}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Emitir</button>
          </div>
        </div>
      )}
    </FinShell>
  );
}
