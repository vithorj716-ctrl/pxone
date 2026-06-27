import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { calcCubagem, calcPesoCubado, calcPesoTaxado, escolherRegra, calcValorFrete, codigoVolume, type RegraFrete } from "@/lib/tms";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tms/solicitacoes/nova")({
  head: () => ({ meta: [{ title: "PXLog — Nova Solicitação" }] }),
  component: NovaSolicitacaoPage,
});

function NovaSolicitacaoPage() {
  const navigate = useNavigate();
  const { empresa } = useEmpresaAtiva();
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [regras, setRegras] = useState<RegraFrete[]>([]);
  const [saving, setSaving] = useState(false);

  const [f, setF] = useState({
    cliente_id: "",
    remetente: "", remetente_telefone: "",
    destinatario: "", destinatario_telefone: "",
    origem: "Goiânia/GO", destino: "Brasília/DF",
    qtd_volumes: 1,
    peso: 0, altura: 0, largura: 0, comprimento: 0,
    valor_mercadoria: 0, tipo_mercadoria: "",
    necessita_coleta: false, data_coleta: "",
    janela_atendimento: "", observacoes: "",
  });

  useEffect(() => {
    (async () => {
      const [c, r] = await Promise.all([
        supabase.from("tms_clientes").select("id, nome").order("nome"),
        supabase.from("tms_tabela_frete").select("*").eq("ativo", true),
      ]);
      setClientes(((c.data ?? []) as any[]));
      setRegras(((r.data ?? []) as any[]));
    })();
  }, []);

  const calc = useMemo(() => {
    const cubagem = calcCubagem(f.altura, f.largura, f.comprimento, f.qtd_volumes);
    const peso_cubado = calcPesoCubado(cubagem);
    const peso_taxado = calcPesoTaxado(f.peso, peso_cubado);
    const regra = escolherRegra({
      regras, cliente_id: f.cliente_id || null,
      origem: f.origem, destino: f.destino, peso_taxado, cubagem,
    });
    const valor_frete = calcValorFrete(regra, peso_taxado, cubagem);
    return { cubagem, peso_cubado, peso_taxado, valor_frete, prazo: regra?.prazo_dias ?? 1 };
  }, [f, regras]);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.destino || !f.origem) { toast.error("Origem e destino são obrigatórios"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("tms_minutas")
      .insert({
        empresa_id: empresa?.id ?? null,
        cliente_id: f.cliente_id || null,
        remetente: { nome: f.remetente, telefone: f.remetente_telefone },
        destinatario: { nome: f.destinatario, telefone: f.destinatario_telefone },
        origem: f.origem, destino: f.destino,
        qtd_volumes: f.qtd_volumes,
        peso: f.peso, cubagem: calc.cubagem,
        peso_cubado: calc.peso_cubado, peso_taxado: calc.peso_taxado,
        valor_mercadoria: f.valor_mercadoria, tipo_mercadoria: f.tipo_mercadoria,
        valor_frete: calc.valor_frete, prazo_dias: calc.prazo,
        necessita_coleta: f.necessita_coleta,
        data_coleta: f.data_coleta || null,
        janela_atendimento: f.janela_atendimento,
        observacoes: f.observacoes,
        status: "solicitado",
        status_financeiro: "previsto",
      })
      .select("id, numero")
      .single();

    if (error || !data) { toast.error(error?.message ?? "Falha ao criar"); setSaving(false); return; }

    const minuta = data as { id: string; numero: number };
    // Gerar volumes
    const volumes = Array.from({ length: f.qtd_volumes }, (_, i) => ({
      minuta_id: minuta.id,
      numero: i + 1,
      codigo: codigoVolume(minuta.numero, i + 1),
      peso: f.qtd_volumes > 0 ? Number(f.peso) / f.qtd_volumes : 0,
      altura: f.altura, largura: f.largura, comprimento: f.comprimento,
      status: "solicitado",
    }));
    await supabase.from("tms_volumes").insert(volumes);
    await supabase.from("tms_eventos").insert({
      minuta_id: minuta.id, tipo: "solicitado", origem_evento: "Nova solicitação",
    });

    toast.success(`Minuta #${minuta.numero} criada`);
    navigate({ to: "/tms/minutas/$numero", params: { numero: String(minuta.numero) } });
  }

  return (
    <AppShell title="Nova Solicitação de Embarque" subtitle="Cálculo automático de cubagem, peso taxado e frete">
      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Cliente e Rota">
            <Sel label="Cliente" value={f.cliente_id} onChange={(v) => set("cliente_id", v)}
              options={[{ value: "", label: "— Selecionar —" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]} />
            <Inp label="Origem" value={f.origem} onChange={(v) => set("origem", v)} required />
            <Inp label="Destino" value={f.destino} onChange={(v) => set("destino", v)} required />
          </Card>

          <Card title="Remetente / Destinatário">
            <Inp label="Remetente" value={f.remetente} onChange={(v) => set("remetente", v)} />
            <Inp label="Tel. remetente" value={f.remetente_telefone} onChange={(v) => set("remetente_telefone", v)} />
            <Inp label="Destinatário" value={f.destinatario} onChange={(v) => set("destinatario", v)} />
            <Inp label="Tel. destinatário" value={f.destinatario_telefone} onChange={(v) => set("destinatario_telefone", v)} />
          </Card>

          <Card title="Mercadoria e Volumes">
            <Inp label="Qtd volumes" type="number" value={f.qtd_volumes} onChange={(v) => set("qtd_volumes", Number(v) || 1)} />
            <Inp label="Peso total (kg)" type="number" value={f.peso} onChange={(v) => set("peso", Number(v))} step="0.01" />
            <Inp label="Altura (cm)" type="number" value={f.altura} onChange={(v) => set("altura", Number(v))} />
            <Inp label="Largura (cm)" type="number" value={f.largura} onChange={(v) => set("largura", Number(v))} />
            <Inp label="Comprimento (cm)" type="number" value={f.comprimento} onChange={(v) => set("comprimento", Number(v))} />
            <Inp label="Valor mercadoria" type="number" value={f.valor_mercadoria} onChange={(v) => set("valor_mercadoria", Number(v))} step="0.01" />
            <Inp label="Tipo mercadoria" value={f.tipo_mercadoria} onChange={(v) => set("tipo_mercadoria", v)} />
          </Card>

          <Card title="Coleta e Observações">
            <label className="flex items-center gap-2 text-xs col-span-2">
              <input type="checkbox" checked={f.necessita_coleta} onChange={(e) => set("necessita_coleta", e.target.checked)} />
              Necessita coleta
            </label>
            {f.necessita_coleta && (
              <>
                <Inp label="Data coleta" type="date" value={f.data_coleta} onChange={(v) => set("data_coleta", v)} />
                <Inp label="Janela" value={f.janela_atendimento} onChange={(v) => set("janela_atendimento", v)} placeholder="08h–12h" />
              </>
            )}
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</label>
              <textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)}
                className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm" rows={3} />
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 self-start space-y-3 rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold">Cálculo automático</h3>
          <Row label="Cubagem" value={`${calc.cubagem.toFixed(3)} m³`} />
          <Row label="Peso cubado" value={`${calc.peso_cubado.toFixed(2)} kg`} />
          <Row label="Peso taxado" value={`${calc.peso_taxado.toFixed(2)} kg`} mono />
          <Row label="Prazo" value={`${calc.prazo} dia(s)`} />
          <div className="border-t border-border pt-2 mt-2">
            <Row label="Valor do frete" value={calc.valor_frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} highlight />
          </div>
          <button type="submit" disabled={saving}
            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Save className="size-4" /> {saving ? "Gerando minuta…" : "Gerar minuta"}
          </button>
        </aside>
      </form>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function Inp({ label, value, onChange, type = "text", step, required, placeholder }: {
  label: string; value: any; onChange: (v: string) => void;
  type?: string; step?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} step={step} required={required} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm" />
    </div>
  );
}
function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="col-span-2">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-surface ring-1 ring-border rounded-md px-2 py-1.5 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-lg font-semibold text-brand" : "tabular-nums"}`}>{value}</span>
    </div>
  );
}
