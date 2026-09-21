import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FinShell, brl } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarCadastros, finSalvarCadastro } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro/configuracoes")({
  head: () => ({
    meta: [
      { title: "Contas e categorias — Financeiro PX" },
      { name: "description", content: "Contas financeiras, categorias e centros de custo do Financeiro." },
      { property: "og:title", content: "Contas e categorias — Financeiro PX" },
      { property: "og:description", content: "Configuração do módulo financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

type Tabela = "fin_contas" | "fin_categorias" | "fin_centros_custo";

function Configuracoes() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [form, setForm] = useState<{ tabela: Tabela; id?: string | null; payload: any } | null>(null);

  const listar = useServerFn(finListarCadastros);
  const salvar = useServerFn(finSalvarCadastro);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fin-cadastros", empresa?.id ?? null],
    queryFn: () => listar({ data: { empresaId: empresa?.id ?? null } }),
  });

  const mSalvar = useMutation({
    mutationFn: (v: any) => salvar({ data: { tabela: v.tabela, id: v.id ?? null, empresaId: empresa?.id ?? null, payload: v.payload } }),
    onSuccess: () => { toast.success("Cadastro salvo"); setForm(null); qc.invalidateQueries({ queryKey: ["fin-cadastros"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const blocos: { tabela: Tabela; titulo: string; rows: any[] }[] = [
    { tabela: "fin_contas", titulo: "Contas financeiras", rows: (data?.contas ?? []) as any[] },
    { tabela: "fin_categorias", titulo: "Categorias", rows: (data?.categorias ?? []) as any[] },
    { tabela: "fin_centros_custo", titulo: "Centros de custo", rows: (data?.centros ?? []) as any[] },
  ];

  return (
    <FinShell title="Contas e categorias" subtitle="Configuração do Financeiro">
      {error && <div className="text-xs text-rose-300">{(error as Error).message}</div>}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {blocos.map((b) => (
            <div key={b.tabela} className="rounded-xl ring-1 ring-border bg-surface/60">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.titulo}</span>
                <button onClick={() => setForm({ tabela: b.tabela, payload: { ativo: true } })}
                  className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">Novo</button>
              </div>
              <ul className="divide-y divide-border/40 text-xs">
                {b.rows.length === 0 ? (
                  <li className="p-4 text-muted-foreground text-center">Nada cadastrado.</li>
                ) : b.rows.map((r) => (
                  <li key={r.id} className="p-2 flex items-center justify-between gap-2 hover:bg-white/5 cursor-pointer"
                    onClick={() => setForm({ tabela: b.tabela, id: r.id, payload: { ...r } })}>
                    <span className="truncate">{r.nome}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {b.tabela === "fin_contas" ? brl(r.saldo_inicial) : r.tipo ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setForm(null)} />
          <div className="relative w-full sm:w-[380px] h-full overflow-y-auto thin-scroll border-l border-border p-4 space-y-2 text-xs" style={{ background: "#0f0f12" }}>
            <h2 className="text-sm font-semibold">{form.id ? "Editar" : "Novo"} — {form.tabela.replace("fin_", "").replace("_", " ")}</h2>
            <input className="input w-full" placeholder="Nome" value={form.payload.nome ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, nome: e.target.value } })} />
            {form.tabela === "fin_contas" && (
              <>
                <select className="input w-full" value={form.payload.tipo ?? "banco"}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, tipo: e.target.value } })}>
                  {["banco", "caixa", "aplicacao", "outro"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input w-full" type="number" step="0.01" placeholder="Saldo inicial"
                  value={form.payload.saldo_inicial ?? ""} onChange={(e) => setForm({ ...form, payload: { ...form.payload, saldo_inicial: Number(e.target.value) } })} />
                <input className="input w-full" placeholder="Banco" value={form.payload.banco ?? ""}
                  onChange={(e) => setForm({ ...form, payload: { ...form.payload, banco: e.target.value } })} />
              </>
            )}
            {form.tabela === "fin_categorias" && (
              <select className="input w-full" value={form.payload.tipo ?? "despesa"}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, tipo: e.target.value } })}>
                <option value="despesa">despesa</option>
                <option value="receita">receita</option>
              </select>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.payload.ativo ?? true}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, ativo: e.target.checked } })} />
              Ativo
            </label>
            <button disabled={mSalvar.isPending} onClick={() => mSalvar.mutate(form)}
              className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}
    </FinShell>
  );
}
