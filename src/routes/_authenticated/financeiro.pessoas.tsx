import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { FinShell } from "@/components/financeiro/fin-shell";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { finListarPessoas, finSalvarPessoa } from "@/lib/financeiro.functions";

export const Route = createFileRoute("/_authenticated/financeiro/pessoas")({
  head: () => ({
    meta: [
      { title: "Colaboradores e prestadores — Financeiro PX" },
      { name: "description", content: "Cadastro financeiro de colaboradores, prestadores, motoristas e fornecedores." },
      { property: "og:title", content: "Colaboradores e prestadores — Financeiro PX" },
      { property: "og:description", content: "Pessoas vinculadas a pagamentos da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pessoas,
});

const TIPOS = ["colaborador", "prestador", "motorista", "fornecedor", "outro"];

function Pessoas() {
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<any | null>(null);

  const listar = useServerFn(finListarPessoas);
  const salvar = useServerFn(finSalvarPessoa);
  const filtros = { empresaId: empresa?.id ?? null, tipo: tipo || null, busca: busca || null };
  const { data, isLoading, error } = useQuery({ queryKey: ["fin-pessoas", filtros], queryFn: () => listar({ data: filtros }) });

  const mSalvar = useMutation({
    mutationFn: (v: any) => salvar({ data: { id: v.id ?? null, empresaId: empresa?.id ?? null, payload: v.payload } }),
    onSuccess: () => { toast.success("Pessoa salva"); setForm(null); qc.invalidateQueries({ queryKey: ["fin-pessoas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data ?? []) as any[];

  return (
    <FinShell
      title="Colaboradores e prestadores"
      subtitle="Cadastro financeiro"
      actions={
        <button onClick={() => setForm({ payload: { tipo: "colaborador", ativo: true } })}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-600 text-white">
          <Plus className="size-3.5" /> Nova pessoa
        </button>
      }
    >
      <div className="flex flex-wrap gap-2 text-xs">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-44">
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input w-56" placeholder="Buscar nome ou documento" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="rounded-xl ring-1 ring-border bg-surface/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Documento</th>
              <th className="text-left p-2">Chave PIX</th>
              <th className="text-left p-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={5} className="p-6 text-center text-rose-300">{(error as Error).message}</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma pessoa cadastrada.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-b border-border/40 hover:bg-white/5 cursor-pointer" onClick={() => setForm({ id: p.id, payload: { ...p } })}>
                <td className="p-2">{p.nome}</td>
                <td className="p-2">{p.tipo}</td>
                <td className="p-2">{p.documento ?? "—"}</td>
                <td className="p-2">{p.chave_pix ?? "—"}</td>
                <td className="p-2">{p.ativo ? "ativo" : "inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setForm(null)} />
          <div className="relative w-full sm:w-[400px] h-full overflow-y-auto thin-scroll border-l border-border p-4 space-y-2 text-xs" style={{ background: "#0f0f12" }}>
            <h2 className="text-sm font-semibold">{form.id ? "Editar pessoa" : "Nova pessoa"}</h2>
            <input className="input w-full" placeholder="Nome" value={form.payload.nome ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, nome: e.target.value } })} />
            <select className="input w-full" value={form.payload.tipo ?? "colaborador"}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, tipo: e.target.value } })}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input w-full" placeholder="Documento (CPF/CNPJ)" value={form.payload.documento ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, documento: e.target.value } })} />
            <input className="input w-full" placeholder="Função" value={form.payload.funcao ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, funcao: e.target.value } })} />
            <input className="input w-full" placeholder="Chave PIX" value={form.payload.chave_pix ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, chave_pix: e.target.value } })} />
            <input className="input w-full" placeholder="Banco / conta" value={form.payload.dados_bancarios ?? ""}
              onChange={(e) => setForm({ ...form, payload: { ...form.payload, dados_bancarios: e.target.value } })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.payload.ativo ?? true}
                onChange={(e) => setForm({ ...form, payload: { ...form.payload, ativo: e.target.checked } })} />
              Ativo
            </label>
            <div className="flex gap-2 pt-2">
              <button disabled={mSalvar.isPending} onClick={() => mSalvar.mutate(form)}
                className="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-50">Salvar</button>
              <button onClick={() => setForm(null)} className="px-3 py-2 rounded-md ring-1 ring-border">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </FinShell>
  );
}
