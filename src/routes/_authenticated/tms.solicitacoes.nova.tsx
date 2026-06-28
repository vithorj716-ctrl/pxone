import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TmsShell } from "@/components/tms/tms-shell";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { calcCubagem, calcPesoCubado, calcPesoTaxado, escolherRegra, calcValorFrete, codigoVolume, type RegraFrete } from "@/lib/tms";
import { toast } from "sonner";
import { Save, Search, MapPin, User, Building2, AlertTriangle, Check, ChevronsUpDown, Pencil, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { listClientes } from "@/lib/px-registry.functions";
import { TIPOS_ENDERECO } from "@/lib/px-enderecos.functions";
import { loadClienteCompleto } from "@/lib/px-nova-solicitacao.functions";
import { getCreditoCliente, liberarBloqueio, type SaldoCliente } from "@/lib/px-credito.functions";
import { NovoClienteDialog } from "@/components/registry/novo-cliente-dialog";

export const Route = createFileRoute("/_authenticated/tms/solicitacoes/nova")({
  head: () => ({ meta: [{ title: "PXLog — Nova Solicitação" }] }),
  component: NovaSolicitacaoPage,
});

type Cliente = any;
type Endereco = any;
type Contato = any;

type EndSnap = {
  endereco_id: string | null;
  contato_id: string | null;
  nome: string;
  telefone: string;
  contato: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ponto_referencia: string;
  observacoes: string;
  janela_recebimento: string;
  restricoes: string[];
};

function emptyEnd(): EndSnap {
  return {
    endereco_id: null, contato_id: null,
    nome: "", telefone: "", contato: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    ponto_referencia: "", observacoes: "", janela_recebimento: "", restricoes: [],
  };
}

const PAGADOR_OPTS = [
  { value: "contratante", label: "Cliente Contratante" },
  { value: "remetente", label: "Remetente" },
  { value: "destinatario", label: "Destinatário" },
  { value: "terceiro", label: "Terceiro / Outro cliente" },
] as const;

function NovaSolicitacaoPage() {
  const navigate = useNavigate();
  const { empresa } = useEmpresaAtiva();
  const fnList = useServerFn(listClientes);
  const fnLoad = useServerFn(loadClienteCompleto);
  const fnCredito = useServerFn(getCreditoCliente);
  const fnLiberar = useServerFn(liberarBloqueio);

  const [clientes, setClientes] = useState<{ id: string; razao_social: string; nome_fantasia?: string; cnpj?: string }[]>([]);
  const [regras, setRegras] = useState<RegraFrete[]>([]);
  const [saving, setSaving] = useState(false);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);

  // Dados do contratante carregados
  const [contratante, setContratante] = useState<Cliente | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [tmsClienteId, setTmsClienteId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<SaldoCliente | null>(null);
  const [credito, setCredito] = useState<any>(null);
  const [autorizadoBloqueio, setAutorizadoBloqueio] = useState(false);

  const [pagador, setPagador] = useState<string>("contratante");

  const [rem, setRem] = useState<EndSnap>(emptyEnd());
  const [dst, setDst] = useState<EndSnap>(emptyEnd());

  const [merc, setMerc] = useState({
    descricao: "", qtd_volumes: 1,
    peso: 0, altura: 0, largura: 0, comprimento: 0,
    valor_mercadoria: 0, numero_nf: "", numero_cte: "",
    tipo_mercadoria: "outros" as string,
  });

  const [coleta, setColeta] = useState({ necessita: false, data: "", janela: "" });
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    (async () => {
      const [c, r] = await Promise.all([
        fnList({ data: { sistema: "pxlog" } }).catch(() => []),
        supabase.from("tms_tabela_frete").select("*").eq("ativo", true),
      ]);
      setClientes((c as any[]) ?? []);
      setRegras(((r.data ?? []) as any[]));
    })();
  }, []);

  async function selecionarContratante(cliente_id: string) {
    try {
      const data = await fnLoad({ data: { cliente_id } });
      setContratante(data.cliente);
      setEnderecos(data.enderecos);
      setContatos(data.contatos);
      setTmsClienteId(data.tms_cliente_id);
      setAutorizadoBloqueio(false);
      // Auto-preencher remetente padrão se houver
      const padRem = data.enderecos.find((e: any) => e.is_padrao_remetente);
      if (padRem) aplicarEndereco(padRem, data.contatos, setRem);
      // Carregar conta corrente / saldo
      try {
        const cc = await fnCredito({ data: { cliente_id } });
        setCredito(cc.credito);
        setSaldo(cc.saldo);
      } catch { setCredito(null); setSaldo(null); }
    } catch (e: any) { toast.error(e?.message || "Falha ao carregar cliente"); }
  }

  const liberadoVigente = !!(credito?.liberado_ate && new Date(credito.liberado_ate) > new Date());
  const bloqueadoAtivo = !!(saldo?.bloqueado && !liberadoVigente);
  const temVencido = !!(saldo && saldo.vencido > 0);



  function aplicarEndereco(end: Endereco, allContatos: Contato[], setter: (v: EndSnap) => void) {
    const principal = allContatos.find((c) => c.endereco_id === end.id && c.is_principal)
      ?? allContatos.find((c) => c.endereco_id === end.id);
    setter({
      endereco_id: end.id,
      contato_id: principal?.id ?? null,
      nome: end.apelido || contratante?.nome_fantasia || contratante?.razao_social || "",
      telefone: principal?.telefone ?? "",
      contato: principal?.nome ?? "",
      cep: end.cep ?? "", logradouro: end.logradouro ?? "",
      numero: end.numero ?? "", complemento: end.complemento ?? "",
      bairro: end.bairro ?? "", cidade: end.cidade ?? "", uf: end.uf ?? "",
      ponto_referencia: end.ponto_referencia ?? "",
      observacoes: end.observacoes ?? "",
      janela_recebimento: end.janela_recebimento ?? "",
      restricoes: end.restricoes ?? [],
    });
  }

  const origem = `${rem.cidade}/${rem.uf}`.replace(/^\/$/, "");
  const destino = `${dst.cidade}/${dst.uf}`.replace(/^\/$/, "");

  const calc = useMemo(() => {
    const cubagem = calcCubagem(merc.altura, merc.largura, merc.comprimento, merc.qtd_volumes);
    const peso_cubado = calcPesoCubado(cubagem);
    const peso_taxado = calcPesoTaxado(merc.peso, peso_cubado);
    const regra = escolherRegra({
      regras, cliente_id: tmsClienteId,
      origem, destino, peso_taxado, cubagem,
    });
    const valor_frete = calcValorFrete(regra, peso_taxado, cubagem);
    return {
      cubagem, peso_cubado, peso_taxado, valor_frete,
      prazo: regra?.prazo_dias ?? contratante?.prazo_padrao_dias ?? 1,
      tabela_nome: regra ? `${regra.tipo_cobranca}` : null,
    };
  }, [merc, regras, tmsClienteId, origem, destino, contratante]);

  const excedeLimite = !!(saldo && saldo.limite_credito > 0 && (saldo.utilizado + calc.valor_frete) > saldo.limite_credito);
  const statusFin: "ok" | "alerta" | "vencido" | "bloqueado" = bloqueadoAtivo
    ? "bloqueado"
    : temVencido
      ? "vencido"
      : excedeLimite
        ? "alerta"
        : "ok";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contratante) { toast.error("Selecione o cliente contratante"); return; }
    if (!rem.cidade || !dst.cidade) { toast.error("Selecione remetente e destinatário"); return; }
    if ((bloqueadoAtivo || excedeLimite || temVencido) && !autorizadoBloqueio) {
      toast.error("Cliente bloqueado — autorize na seção financeira para continuar");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("tms_minutas")
        .insert({
          empresa_id: empresa?.id ?? null,
          cliente_id: tmsClienteId,
          remetente: { ...rem, registry_cliente_id: contratante.id },
          destinatario: { ...dst, registry_cliente_id: contratante.id },
          origem, destino,
          qtd_volumes: merc.qtd_volumes,
          peso: merc.peso, cubagem: calc.cubagem,
          peso_cubado: calc.peso_cubado, peso_taxado: calc.peso_taxado,
          valor_mercadoria: merc.valor_mercadoria,
          tipo_mercadoria: merc.tipo_mercadoria,
          valor_frete: calc.valor_frete, prazo_dias: calc.prazo,
          necessita_coleta: coleta.necessita,
          data_coleta: coleta.data || null,
          janela_atendimento: coleta.janela || dst.janela_recebimento,
          observacoes: [
            observacoes,
            dst.observacoes && `Entrega: ${dst.observacoes}`,
            dst.restricoes?.length && `Restrições: ${dst.restricoes.join("; ")}`,
            merc.numero_nf && `NF: ${merc.numero_nf}`,
            merc.numero_cte && `CT-e: ${merc.numero_cte}`,
            merc.descricao && `Mercadoria: ${merc.descricao}`,
            `Pagador do frete: ${PAGADOR_OPTS.find(p => p.value === pagador)?.label}`,
          ].filter(Boolean).join("\n"),
          status: "solicitado",
          status_financeiro: "previsto",
        })
        .select("id, numero").single();
      if (error || !data) throw error ?? new Error("Falha ao criar");
      const minuta = data as { id: string; numero: number };
      const volumes = Array.from({ length: merc.qtd_volumes }, (_, i) => ({
        minuta_id: minuta.id, numero: i + 1, codigo: codigoVolume(minuta.numero, i + 1),
        peso: merc.qtd_volumes > 0 ? Number(merc.peso) / merc.qtd_volumes : 0,
        altura: merc.altura, largura: merc.largura, comprimento: merc.comprimento,
        status: "solicitado",
      }));
      await supabase.from("tms_volumes").insert(volumes);
      await supabase.from("tms_eventos").insert({
        minuta_id: minuta.id, tipo: "solicitado", origem_evento: "Nova solicitação",
      });
      toast.success(`Minuta #${minuta.numero} criada`);
      navigate({ to: "/tms/minutas/$numero", params: { numero: String(minuta.numero) } });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao criar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TmsShell title="Nova Solicitação de Embarque" subtitle="Selecione o cliente — endereços, contatos e tabela de frete carregam automaticamente">
      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* 1. CONTRATANTE */}
          <SectionCard
            title="Cliente Contratante"
            icon={<Building2 className="size-4" />}
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => setNovoClienteOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Novo cliente
              </Button>
            }
          >
            <ClienteCombobox
              clientes={clientes}
              value={contratante?.id ?? null}
              onChange={(id) => id && selecionarContratante(id)}
            />
            {contratante && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <MetaPill label="Condição pgto" value={contratante.condicao_pagamento || "—"} />
                <MetaPill label="Prazo padrão" value={contratante.prazo_padrao_dias ? `${contratante.prazo_padrao_dias} dias` : "—"} />
                <MetaPill label="Limite crédito" value={contratante.limite_credito ? Number(contratante.limite_credito).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} />
                <MetaPill label="Endereços" value={`${enderecos.length} cad.`} />
                {contratante.observacoes_comerciais && (
                  <div className="col-span-2 sm:col-span-4 text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5">
                    <strong>Comercial:</strong> {contratante.observacoes_comerciais}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* 2. PAGADOR */}
          {contratante && (
            <SectionCard title="Pagador do Frete" icon={<User className="size-4" />}>
              <Select value={pagador} onValueChange={setPagador}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGADOR_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-3 rounded-md border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><AlertTriangle className="size-3.5 text-amber-400" />
                  Controle de conta corrente e bloqueio por inadimplência será integrado na próxima fase.
                </div>
              </div>
            </SectionCard>
          )}

          {/* 3. REMETENTE */}
          {contratante && (
            <EnderecoCard
              titulo="Remetente"
              papel="remetente"
              snap={rem}
              setSnap={setRem}
              enderecos={enderecos}
              contatos={contatos}
              aplicarEndereco={(end) => aplicarEndereco(end, contatos, setRem)}
            />
          )}

          {/* 4. DESTINATÁRIO */}
          {contratante && (
            <EnderecoCard
              titulo="Destinatário"
              papel="destinatario"
              snap={dst}
              setSnap={setDst}
              enderecos={enderecos}
              contatos={contatos}
              aplicarEndereco={(end) => aplicarEndereco(end, contatos, setDst)}
            />
          )}

          {/* 5. MERCADORIA */}
          {contratante && (
            <SectionCard title="Mercadoria">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <FieldBlock label="Descrição" span={4}>
                  <Input value={merc.descricao} onChange={(e) => setMerc({ ...merc, descricao: e.target.value })} />
                </FieldBlock>
                <FieldBlock label="Tipo">
                  <Select value={merc.tipo_mercadoria} onValueChange={(v) => setMerc({ ...merc, tipo_mercadoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                      <SelectItem value="cosmetico">Cosmético</SelectItem>
                      <SelectItem value="correlato">Correlato</SelectItem>
                      <SelectItem value="material_hospitalar">Material Hospitalar</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldBlock>
                <FieldBlock label="Volumes"><NumericInput variant="integer" value={merc.qtd_volumes} onValueChange={(n) => setMerc({ ...merc, qtd_volumes: n ?? 1 })} /></FieldBlock>
                <FieldBlock label="Peso (kg)"><NumericInput variant="weight" value={merc.peso} onValueChange={(n) => setMerc({ ...merc, peso: n ?? 0 })} /></FieldBlock>
                <FieldBlock label="Valor NF"><NumericInput variant="currency" value={merc.valor_mercadoria} onValueChange={(n) => setMerc({ ...merc, valor_mercadoria: n ?? 0 })} /></FieldBlock>
                <FieldBlock label="Altura (cm)"><NumericInput variant="integer" value={merc.altura} onValueChange={(n) => setMerc({ ...merc, altura: n ?? 0 })} /></FieldBlock>
                <FieldBlock label="Largura (cm)"><NumericInput variant="integer" value={merc.largura} onValueChange={(n) => setMerc({ ...merc, largura: n ?? 0 })} /></FieldBlock>
                <FieldBlock label="Comprimento (cm)"><NumericInput variant="integer" value={merc.comprimento} onValueChange={(n) => setMerc({ ...merc, comprimento: n ?? 0 })} /></FieldBlock>
                <FieldBlock label="Nº Nota Fiscal"><Input value={merc.numero_nf} onChange={(e) => setMerc({ ...merc, numero_nf: e.target.value })} /></FieldBlock>
                <FieldBlock label="Nº CT-e (opcional)" span={2}><Input value={merc.numero_cte} onChange={(e) => setMerc({ ...merc, numero_cte: e.target.value })} /></FieldBlock>
              </div>
            </SectionCard>
          )}

          {/* COLETA & OBS */}
          {contratante && (
            <SectionCard title="Coleta e Observações">
              <label className="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" checked={coleta.necessita} onChange={(e) => setColeta({ ...coleta, necessita: e.target.checked })} />
                Necessita coleta
              </label>
              {coleta.necessita && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <FieldBlock label="Data coleta"><Input type="date" value={coleta.data} onChange={(e) => setColeta({ ...coleta, data: e.target.value })} /></FieldBlock>
                  <FieldBlock label="Janela"><Input value={coleta.janela} onChange={(e) => setColeta({ ...coleta, janela: e.target.value })} placeholder="08h–12h" /></FieldBlock>
                </div>
              )}
              <FieldBlock label="Observações gerais" span={4}>
                <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </FieldBlock>
            </SectionCard>
          )}
        </div>

        {/* RESUMO LATERAL */}
        <aside className="lg:sticky lg:top-20 self-start space-y-3 rounded-xl ring-1 ring-border bg-surface/60 p-4">
          <h3 className="text-sm font-semibold">Resumo</h3>
          <Row label="Cliente" value={contratante ? (contratante.nome_fantasia || contratante.razao_social) : "—"} />
          <Row label="Pagador" value={PAGADOR_OPTS.find(p => p.value === pagador)?.label ?? "—"} />
          <Row label="Tabela" value={calc.tabela_nome ?? "—"} />
          <div className="border-t border-border pt-2" />
          <Row label="Origem" value={origem || "—"} />
          <Row label="Destino" value={destino || "—"} />
          <Row label="Cubagem" value={`${calc.cubagem.toFixed(3)} m³`} />
          <Row label="Peso real" value={`${merc.peso.toFixed(2)} kg`} />
          <Row label="Peso taxado" value={`${calc.peso_taxado.toFixed(2)} kg`} mono />
          <Row label="Prazo" value={`${calc.prazo} dia(s)`} />
          <div className="border-t border-border pt-2" />
          <Row label="Limite crédito" value={contratante?.limite_credito ? Number(contratante.limite_credito).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} />
          <Row label="Situação financeira" value={<span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400" />OK</span>} />
          <div className="border-t border-border pt-2">
            <Row label="Valor do frete" value={calc.valor_frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} highlight />
          </div>
          <button type="submit" disabled={saving || !contratante}
            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Save className="size-4" /> {saving ? "Gerando minuta…" : "Gerar minuta"}
          </button>
        </aside>
      </form>

      <NovoClienteDialog
        open={novoClienteOpen}
        onOpenChange={setNovoClienteOpen}
        sistema="pxlog"
        onSaved={async (saved) => {
          // refresh lista & selecionar
          const list = await fnList({ data: { sistema: "pxlog" } }).catch(() => []);
          setClientes((list as any[]) ?? []);
          if (saved?.id) await selecionarContratante(saved.id);
        }}
      />
    </TmsShell>
  );
}

/* ---------- Subcomponentes ---------- */

function SectionCard({ title, icon, actions, children }: { title: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">{icon}{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function FieldBlock({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 | 3 | 4 }) {
  const cls = span === 4 ? "sm:col-span-4" : span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : "";
  return (
    <div className={`space-y-1 ${cls}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium truncate">{value}</div>
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: React.ReactNode; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-lg font-semibold text-brand" : "tabular-nums"} text-right truncate`}>{value}</span>
    </div>
  );
}

function ClienteCombobox({ clientes, value, onChange }: {
  clientes: { id: string; razao_social: string; nome_fantasia?: string; cnpj?: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = clientes.find(c => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-sm hover:bg-white/5">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected ? (selected.nome_fantasia || selected.razao_social) : "Selecionar cliente contratante…"}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar por nome ou CNPJ…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nome_fantasia ?? ""} ${c.razao_social} ${c.cnpj ?? ""}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={`size-4 mr-2 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  <div className="flex flex-col">
                    <span className="text-sm">{c.nome_fantasia || c.razao_social}</span>
                    {c.cnpj && <span className="text-[10px] text-muted-foreground">CNPJ {c.cnpj}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EnderecoCard({
  titulo, papel, snap, setSnap, enderecos, contatos, aplicarEndereco,
}: {
  titulo: string;
  papel: "remetente" | "destinatario";
  snap: EndSnap;
  setSnap: (v: EndSnap) => void;
  enderecos: Endereco[];
  contatos: Contato[];
  aplicarEndereco: (end: Endereco) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const sugeridos = papel === "remetente"
    ? [...enderecos].sort((a, b) => Number(!!b.is_padrao_remetente) - Number(!!a.is_padrao_remetente))
    : [...enderecos].sort((a, b) => Number(!!b.is_padrao_destinatario) - Number(!!a.is_padrao_destinatario));

  const contatosDoEndereco = contatos.filter(c => c.endereco_id === snap.endereco_id);
  const podeEditar = !!snap.endereco_id || editando;
  const vazio = !snap.endereco_id && !snap.cidade;

  return (
    <SectionCard
      title={titulo}
      icon={<MapPin className="size-4" />}
      actions={
        <div className="flex gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Search className="size-3.5 mr-1" /> {snap.endereco_id ? "Trocar endereço" : "Selecionar endereço"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0">
              <Command>
                <CommandInput placeholder="Buscar endereço…" />
                <CommandList>
                  <CommandEmpty>Nenhum endereço cadastrado para este cliente.</CommandEmpty>
                  <CommandGroup>
                    {sugeridos.map((e) => (
                      <CommandItem
                        key={e.id}
                        value={`${e.apelido ?? ""} ${e.cidade ?? ""} ${e.uf ?? ""} ${e.bairro ?? ""}`}
                        onSelect={() => { aplicarEndereco(e); setOpen(false); }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{e.apelido || TIPOS_ENDERECO.find(t => t.value === e.tipo)?.label}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {TIPOS_ENDERECO.find(t => t.value === e.tipo)?.label}
                            </span>
                            {papel === "remetente" && e.is_padrao_remetente && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">padrão</span>}
                            {papel === "destinatario" && e.is_padrao_destinatario && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">padrão</span>}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {[e.logradouro, e.numero, e.bairro].filter(Boolean).join(", ")} • {[e.cidade, e.uf].filter(Boolean).join("/")}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {snap.endereco_id && !editando && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}>
              <Pencil className="size-3.5 mr-1" /> Editar nesta minuta
            </Button>
          )}
          {snap.endereco_id && editando && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
              <X className="size-3.5 mr-1" /> Concluir edição
            </Button>
          )}
        </div>
      }
    >
      {vazio ? (
        <div className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-md">
          Selecione um endereço cadastrado ou clique em "Editar nesta minuta" para preencher manualmente.
          {!editando && (
            <div className="mt-2">
              <Button type="button" variant="link" size="sm" onClick={() => setEditando(true)}>preencher manualmente</Button>
            </div>
          )}
        </div>
      ) : !editando ? (
        <div className="rounded-md border border-border bg-surface/40 p-3 space-y-1.5">
          <div className="text-sm font-medium">{snap.nome || "—"}</div>
          <div className="text-xs text-muted-foreground">
            {[snap.logradouro, snap.numero, snap.complemento, snap.bairro].filter(Boolean).join(", ")}
          </div>
          <div className="text-xs text-muted-foreground">
            {[snap.cidade, snap.uf].filter(Boolean).join("/")} {snap.cep ? `• CEP ${snap.cep}` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            {snap.contato ? `Contato: ${snap.contato}` : ""} {snap.telefone ? `• ${snap.telefone}` : ""}
          </div>
          {snap.janela_recebimento && <div className="text-xs text-amber-300">Janela: {snap.janela_recebimento}</div>}
          {snap.restricoes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {snap.restricoes.map(r => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">{r}</span>
              ))}
            </div>
          )}
          {snap.observacoes && <div className="text-xs text-muted-foreground italic pt-1">"{snap.observacoes}"</div>}
          {contatosDoEndereco.length > 1 && (
            <div className="pt-2 border-t border-border/50">
              <Label className="text-[10px] uppercase">Trocar contato</Label>
              <Select
                value={snap.contato_id ?? ""}
                onValueChange={(id) => {
                  const c = contatosDoEndereco.find(x => x.id === id);
                  if (c) setSnap({ ...snap, contato_id: c.id, contato: c.nome, telefone: c.telefone ?? snap.telefone });
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
                <SelectContent>
                  {contatosDoEndereco.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.setor ? `— ${c.setor}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FieldBlock label="Nome" span={2}><Input value={snap.nome} onChange={(e) => setSnap({ ...snap, nome: e.target.value })} /></FieldBlock>
          <FieldBlock label="Contato" span={2}><Input value={snap.contato} onChange={(e) => setSnap({ ...snap, contato: e.target.value })} /></FieldBlock>
          <FieldBlock label="Telefone"><Input value={snap.telefone} onChange={(e) => setSnap({ ...snap, telefone: e.target.value })} /></FieldBlock>
          <FieldBlock label="CEP"><Input value={snap.cep} onChange={(e) => setSnap({ ...snap, cep: e.target.value })} /></FieldBlock>
          <FieldBlock label="Logradouro" span={2}><Input value={snap.logradouro} onChange={(e) => setSnap({ ...snap, logradouro: e.target.value })} /></FieldBlock>
          <FieldBlock label="Número"><Input value={snap.numero} onChange={(e) => setSnap({ ...snap, numero: e.target.value })} /></FieldBlock>
          <FieldBlock label="Complemento"><Input value={snap.complemento} onChange={(e) => setSnap({ ...snap, complemento: e.target.value })} /></FieldBlock>
          <FieldBlock label="Bairro"><Input value={snap.bairro} onChange={(e) => setSnap({ ...snap, bairro: e.target.value })} /></FieldBlock>
          <FieldBlock label="Cidade"><Input value={snap.cidade} onChange={(e) => setSnap({ ...snap, cidade: e.target.value })} /></FieldBlock>
          <FieldBlock label="UF"><Input value={snap.uf} onChange={(e) => setSnap({ ...snap, uf: e.target.value.toUpperCase().slice(0, 2) })} /></FieldBlock>
          <FieldBlock label="Ponto de referência" span={2}><Input value={snap.ponto_referencia} onChange={(e) => setSnap({ ...snap, ponto_referencia: e.target.value })} /></FieldBlock>
          {papel === "destinatario" && (
            <FieldBlock label="Janela recebimento" span={2}><Input value={snap.janela_recebimento} onChange={(e) => setSnap({ ...snap, janela_recebimento: e.target.value })} /></FieldBlock>
          )}
          <FieldBlock label="Observações" span={4}><Textarea rows={2} value={snap.observacoes} onChange={(e) => setSnap({ ...snap, observacoes: e.target.value })} /></FieldBlock>
          <p className="col-span-full text-[11px] text-muted-foreground italic">
            Alterações aqui ficam apenas nesta minuta — o cadastro original não é alterado.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
