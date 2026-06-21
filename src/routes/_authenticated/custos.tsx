import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Send, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/custos")({
  head: () => ({ meta: [{ title: "PXOne — Central de Custos" }] }),
  component: CentralDeCustos,
});

type TipoCusto = "fixo" | "variavel" | "unico" | "recorrente";

interface Empresa { id: string; codigo: string; nome: string }
interface Categoria { id: string; nome: string }
interface Custo {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  empresa_id: string | null;
  centro_custo: string | null;
  categoria_id: string | null;
  tipo_custo: TipoCusto;
  data: string;
  status: string;
  created_by: string | null;
}

const TIPOS: { value: TipoCusto; label: string }[] = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "unico", label: "Único" },
  { value: "recorrente", label: "Recorrente" },
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function CentralDeCustos() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [exportTarget, setExportTarget] = useState<Custo | null>(null);
  const [showCategoria, setShowCategoria] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [e, c, k] = await Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("categorias_custo").select("id,nome").order("nome"),
      supabase.from("custos").select("*").order("data", { ascending: false }),
    ]);
    if (e.data) setEmpresas(e.data);
    if (c.data) setCategorias(c.data);
    if (k.data) setCustos(k.data as Custo[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const total = useMemo(() => custos.reduce((s, c) => s + Number(c.valor || 0), 0), [custos]);
  const totalPendentes = useMemo(
    () => custos.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0),
    [custos],
  );
  const totalAprovados = useMemo(
    () => custos.filter((c) => c.status === "aprovado").reduce((s, c) => s + Number(c.valor || 0), 0),
    [custos],
  );

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("custos").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    loadAll();
  }

  async function removeCusto(id: string) {
    if (!confirm("Excluir este custo?")) return;
    const { error } = await supabase.from("custos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Custo excluído");
    loadAll();
  }

  return (
    <AppShell
      title="Central de Custos"
      subtitle="Registro real de gastos e investimentos"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoria(true)}
            className="py-2 px-3 bg-surface ring-1 ring-border text-sm font-medium rounded-md hover:bg-surface-2 transition-colors"
          >
            Categorias
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Plus className="size-4" /> Novo custo
          </button>
        </div>
      }
    >
      {/* Summary */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Total lançado" value={fmtBRL(total)} />
        <SummaryCard label="Aguardando aprovação" value={fmtBRL(totalPendentes)} tone="warning" />
        <SummaryCard label="Aprovados" value={fmtBRL(totalAprovados)} tone="brand" />
        <SummaryCard label="Lançamentos" value={custos.length.toString()} />
      </section>

      {/* Lista */}
      <section className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">Lançamentos</h3>
          <span className="text-xs text-muted-foreground">{custos.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : custos.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-muted-foreground">Nenhum custo lançado ainda.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 py-2 px-3 bg-brand text-brand-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              <Plus className="size-3.5" /> Cadastrar primeiro custo
            </button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Empresa</th>
                <th className="px-6 py-3 font-medium">Categoria</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium text-right">Valor</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {custos.map((c) => {
                const empresa = empresas.find((e) => e.id === c.empresa_id);
                const cat = categorias.find((x) => x.id === c.categoria_id);
                const statusColor =
                  c.status === "aprovado" ? "bg-brand/10 text-brand"
                  : c.status === "rejeitado" ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning";
                return (
                  <tr key={c.id} className="text-sm hover:bg-surface-2/40 transition-colors">
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-3 font-medium">
                      <div>{c.nome}</div>
                      {c.descricao && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.descricao}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{empresa?.codigo ?? "—"}</td>
                    <td className="px-6 py-3 text-muted-foreground">{cat?.nome ?? "—"}</td>
                    <td className="px-6 py-3 text-muted-foreground capitalize">{c.tipo_custo}</td>
                    <td className="px-6 py-3 text-right font-mono">{fmtBRL(Number(c.valor))}</td>
                    <td className="px-6 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                        className={`text-[10px] px-2 py-1 rounded font-medium ${statusColor} bg-transparent border-none focus:outline-none cursor-pointer`}
                      >
                        <option value="pendente">pendente</option>
                        <option value="aprovado">aprovado</option>
                        <option value="rejeitado">rejeitado</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setExportTarget(c)}
                        title="Exportar para aprovação"
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Send className="size-4" />
                      </button>
                      <button
                        onClick={() => removeCusto(c.id)}
                        title="Excluir"
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showForm && (
        <CustoForm
          empresas={empresas}
          categorias={categorias}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAll(); }}
        />
      )}

      {showCategoria && (
        <CategoriaManager
          categorias={categorias}
          onClose={() => { setShowCategoria(false); loadAll(); }}
        />
      )}

      {exportTarget && (
        <ExportModal custo={exportTarget} onClose={() => setExportTarget(null)} />
      )}
    </AppShell>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "brand" | "warning" }) {
  const toneClass = tone === "brand" ? "text-brand" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="p-5 bg-surface ring-1 ring-border rounded-xl">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <h2 className={`text-2xl font-medium tracking-tight mt-2 ${toneClass}`}>{value}</h2>
    </div>
  );
}

function CustoForm({
  empresas, categorias, onClose, onSaved,
}: {
  empresas: Empresa[];
  categorias: Categoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? "");
  const [centroCusto, setCentroCusto] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>(categorias[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoCusto>("unico");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !valor) {
      toast.error("Preencha nome e valor");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("custos").insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      valor: Number(valor.replace(",", ".")),
      empresa_id: empresaId || null,
      centro_custo: centroCusto.trim() || null,
      categoria_id: categoriaId || null,
      tipo_custo: tipo,
      data,
      status: "pendente",
      created_by: u.user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Custo cadastrado");
    onSaved();
  }

  return (
    <Modal title="Novo custo" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome do gasto ou investimento">
          <input
            required value={nome} onChange={(e) => setNome(e.target.value)}
            className="input" placeholder="Ex: Licença SaaS XPTO"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2}
            className="input resize-none" placeholder="Contexto / motivo do gasto"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input
              required type="text" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))}
              className="input" placeholder="0,00"
            />
          </Field>
          <Field label="Data">
            <input required type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa">
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input">
              <option value="">—</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Field>
          <Field label="Centro de custo">
            <input
              value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)}
              className="input" placeholder="Ex: TI / Marketing / Frota"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="input">
              <option value="">—</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Tipo de custo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCusto)} className="input">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="py-2 px-3 text-sm rounded-md hover:bg-surface-2 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="py-2 px-4 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoriaManager({
  categorias, onClose,
}: {
  categorias: Categoria[];
  onClose: () => void;
}) {
  const [nome, setNome] = useState("");
  const [list, setList] = useState(categorias);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("categorias_custo").select("id,nome").order("nome");
    if (data) setList(data);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("categorias_custo").insert({ nome: nome.trim() });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNome("");
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categorias_custo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <Modal title="Categorias" onClose={onClose}>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input
          value={nome} onChange={(e) => setNome(e.target.value)}
          className="input flex-1" placeholder="Nova categoria"
        />
        <button type="submit" disabled={saving}
          className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
          Adicionar
        </button>
      </form>
      <ul className="divide-y divide-border max-h-80 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span>{c.nome}</span>
            <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">Nenhuma categoria</li>
        )}
      </ul>
    </Modal>
  );
}

function ExportModal({ custo, onClose }: { custo: Custo; onClose: () => void }) {
  const text = `Solicitação de aprovação – Grupo PX

Gasto: ${custo.nome}
Descrição: ${custo.descricao ?? "—"}
Valor: ${fmtBRL(Number(custo.valor))}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Modal title="Exportar para aprovação" onClose={onClose}>
      <p className="text-xs text-muted-foreground mb-3">
        Texto pronto para envio no WhatsApp dos sócios. A aprovação ocorre fora do sistema.
      </p>
      <pre className="bg-background ring-1 ring-border rounded-md p-4 text-sm whitespace-pre-wrap font-sans">
{text}
      </pre>
      <div className="flex justify-end mt-4">
        <button onClick={copy}
          className="py-2 px-4 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2">
          <Copy className="size-4" /> Copiar texto
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface ring-1 ring-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
