import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, brl, dataBr } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarMovimentos, finEstornarMovimento } from "@/lib/financeiro-titulos.functions";

export const Route = createFileRoute("/_authenticated/financeiro/movimentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos e recebimentos — Financeiro PX" },
      { name: "description", content: "Movimentos financeiros realizados, com estorno rastreado." },
      { property: "og:title", content: "Pagamentos e recebimentos — Financeiro PX" },
      { property: "og:description", content: "Histórico de baixas financeiras da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Movimentos,
});

function Movimentos() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"" | "pagamento" | "recebimento">("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const listar = useServerFn(finListarMovimentos);
  const estornar = useServerFn(finEstornarMovimento);
  const filtros = { empresaId: empresa?.id ?? null, tipo: tipo || null, de: de || null, ate: ate || null };
  const { data, isLoading, error } = useQuery({ queryKey: ["fin-movs", filtros], queryFn: () => listar({ data: filtros as any }) });

  const mEstorno = useMutation({
    mutationFn: (v: { movimentoId: string; motivo: string }) => estornar({ data: v }),
    onSuccess: () => { toast.success("Movimento estornado"); qc.invalidateQueries({ queryKey: ["fin-movs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as any[];

  return (
    <FinShell title="Pagamentos e recebimentos" subtitle="Movimentação realizada">
      <div className="flex flex-wrap gap-2 text-xs">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="input w-40">
          <option value="">Todos</option>
          <option value="pagamento">Pagamentos</option>
          <option value="recebimento">Recebimentos</option>
        </select>
        <input type="date" className="input w-40" value={de} onChange={(e) => setDe(e.target.value)} />
        <input type="date" className="input w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2">Forma</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={6} className="p-6 text-center text-rose-300">{(error as Error).message}</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum movimento no período.</td></tr>
            ) : rows.map((m) => (
              <tr key={m.id} className={`border-b border-border/40 ${m.estornado_em ? "opacity-50" : ""}`}>
                <td className="p-2">{dataBr(m.data)}</td>
                <td className="p-2">{m.tipo}</td>
                <td className="p-2">{m.descricao ?? "—"}</td>
                <td className="p-2">{m.forma ?? "—"}</td>
                <td className={`p-2 text-right tabular-nums ${m.tipo === "recebimento" ? "text-emerald-400" : "text-rose-300"}`}>{brl(m.valor)}</td>
                <td className="p-2 text-right">
                  {m.estornado_em ? (
                    <span className="text-[10px] text-muted-foreground">estornado</span>
                  ) : (
                    <button
                      onClick={() => {
                        const motivo = window.prompt("Motivo do estorno:");
                        if (motivo) mEstorno.mutate({ movimentoId: m.id, motivo });
                      }}
                      className="text-[10px] px-2 py-1 rounded ring-1 ring-rose-500/40 text-rose-300">Estornar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FinShell>
  );
}
