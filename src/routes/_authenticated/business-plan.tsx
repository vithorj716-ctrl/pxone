import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business-plan")({
  head: () => ({ meta: [{ title: "PXOne — Business Plan Center" }] }),
  component: BusinessPlanCenter,
});

type Horizonte = "1_ano" | "3_anos" | "5_anos" | "10_anos";

interface Empresa { id: string; codigo: string; nome: string }
interface Plano {
  id: string;
  titulo: string;
  descricao: string | null;
  empresa_id: string | null;
  horizonte: Horizonte;
  ano_inicio: number;
  meta_receita: number;
  meta_ebitda: number;
  meta_valuation: number;
  progresso: number;
  status: string;
}

const HORIZONTES: { value: Horizonte; label: string }[] = [
  { value: "1_ano", label: "1 Ano" },
  { value: "3_anos", label: "3 Anos" },
  { value: "5_anos", label: "5 Anos" },
  { value: "10_anos", label: "10 Anos" },
];

function fmtBRL(v: number) {
  if (!v) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function BusinessPlanCenter() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<Horizonte | "todos">("todos");

  async function load() {
    setLoading(true);
    const [e, p] = await Promise.all([
      supabase.from("empresas").select("id,codigo,nome").order("codigo"),
      supabase.from("business_plans").select("*").order("ano_inicio", { ascending: false }),
    ]);
    if (e.data) setEmpresas(e.data);
    if (p.data) setPlanos(p.data as Plano[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = planos.filter((p) => filter === "todos" || p.horizonte === filter);

  async function remove(id: string) {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("business_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <AppShell
      title="Business Plan Center"
      subtitle="Planejamento estratégico 1 / 3 / 5 / 10 anos"
      headerActions={
        <button
          onClick={() => setShowForm(true)}
          className="py-2 px-3 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2"
        >
          <Plus className="size-4" /> Novo plano
        </button>
      }
    >
      <div className="flex items-center gap-2 border-b border-border">
        {(["todos", ...HORIZONTES.map((h) => h.value)] as const).map((h) => {
          const label = h === "todos" ? "Todos" : HORIZONTES.find((x) => x.value === h)!.label;
          return (
            <button key={h} onClick={() => setFilter(h)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                filter === h
                  ? "text-foreground border-b-2 border-brand -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center bg-surface ring-1 ring-border rounded-xl">
          <p className="text-sm text-muted-foreground">Nenhum plano cadastrado.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 py-2 px-3 bg-brand text-brand-foreground text-xs font-medium rounded-md hover:opacity-90 inline-flex items-center gap-2"
          >
            <Plus className="size-3.5" /> Criar primeiro plano
          </button>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((plan) => {
            const empresa = empresas.find((e) => e.id === plan.empresa_id);
            return (
              <article key={plan.id} className="p-6 bg-surface ring-1 ring-border rounded-xl space-y-5">
                <header className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand font-medium">
                      Horizonte {HORIZONTES.find((h) => h.value === plan.horizonte)?.label} · {plan.ano_inicio}
                    </p>
                    <h3 className="text-base font-medium mt-1.5 tracking-tight">{plan.titulo}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{empresa?.nome ?? "Grupo PX"}</p>
                  </div>
                  <button onClick={() => remove(plan.id)}
                    className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </header>

                {plan.descricao && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{plan.descricao}</p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Meta Receita" value={fmtBRL(Number(plan.meta_receita))} />
                  <Stat label="Meta EBITDA" value={fmtBRL(Number(plan.meta_ebitda))} />
                  <Stat label="Valuation" value={fmtBRL(Number(plan.meta_valuation))} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{plan.progresso ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${plan.progresso ?? 0}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {showForm && (
        <PlanoForm
          empresas={empresas}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-background ring-1 ring-border rounded-md">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function PlanoForm({
  empresas, onClose, onSaved,
}: { empresas: Empresa[]; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [horizonte, setHorizonte] = useState<Horizonte>("1_ano");
  const [anoInicio, setAnoInicio] = useState(new Date().getFullYear());
  const [metaReceita, setMetaReceita] = useState("");
  const [metaEbitda, setMetaEbitda] = useState("");
  const [metaValuation, setMetaValuation] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return toast.error("Informe o título");
    setSaving(true);
    const { error } = await supabase.from("business_plans").insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      empresa_id: empresaId || null,
      horizonte,
      ano_inicio: anoInicio,
      meta_receita: Number(metaReceita || 0),
      meta_ebitda: Number(metaEbitda || 0),
      meta_valuation: Number(metaValuation || 0),
      progresso,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plano cadastrado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface ring-1 ring-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium">Novo plano</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Título</span>
            <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Descrição</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="input mt-1 resize-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Empresa</span>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="input mt-1">
                <option value="">Grupo PX (consolidado)</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Horizonte</span>
              <select value={horizonte} onChange={(e) => setHorizonte(e.target.value as Horizonte)} className="input mt-1">
                {HORIZONTES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Ano início</span>
              <input type="number" value={anoInicio} onChange={(e) => setAnoInicio(Number(e.target.value))} className="input mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Progresso (%)</span>
              <input type="number" min={0} max={100} value={progresso} onChange={(e) => setProgresso(Number(e.target.value))} className="input mt-1" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Meta Receita</span>
              <input value={metaReceita} onChange={(e) => setMetaReceita(e.target.value)} className="input mt-1" placeholder="0" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Meta EBITDA</span>
              <input value={metaEbitda} onChange={(e) => setMetaEbitda(e.target.value)} className="input mt-1" placeholder="0" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Valuation</span>
              <input value={metaValuation} onChange={(e) => setMetaValuation(e.target.value)} className="input mt-1" placeholder="0" />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="py-2 px-3 text-sm rounded-md hover:bg-surface-2">Cancelar</button>
            <button type="submit" disabled={saving} className="py-2 px-4 bg-brand text-brand-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
              {saving ? "Salvando…" : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
