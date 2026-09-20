import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { saveCotacao, listTabelasFrete, type CotacaoRow } from "@/lib/pxsales-cotacoes.functions";
import { listSalesClientes } from "@/lib/pxsales-clientes.functions";
import { listResponsaveis } from "@/lib/pxsales-pipeline.functions";
import { calcularFrete, TIPOS_OPERACAO, type TabelaFrete } from "@/pxsales/frete-calc";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const vazio: Record<string, any> = {
  cliente_id: "",
  empresa_nome: "",
  contato_nome: "",
  contato_email: "",
  contato_telefone: "",
  origem_cidade: "",
  origem_uf: "",
  origem_cep: "",
  destino_cidade: "",
  destino_uf: "",
  destino_cep: "",
  tipo_operacao: "transferencia",
  tabela_frete_id: "",
  qtd_volumes: "1",
  peso: "",
  cubagem: "",
  valor_mercadoria: "",
  tipo_mercadoria: "",
  prazo_dias: "",
  pedagio: "",
  gris_percentual: "",
  advalorem_percentual: "",
  taxas_extras: "",
  desconto_percentual: "",
  frequencia_mensal: "",
  condicao_pagamento: "",
  validade_ate: "",
  responsavel_id: "",
  observacoes: "",
};

export function CotacaoDialog({
  open,
  onOpenChange,
  cotacao,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cotacao?: CotacaoRow | null;
  onSaved?: (id: string) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(vazio);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveCotacao);
  const { empresa: empresaAtiva } = useEmpresaAtiva();
  const qc = useQueryClient();

  const fnTabelas = useServerFn(listTabelasFrete);
  const fnClientes = useServerFn(listSalesClientes);
  const fnResp = useServerFn(listResponsaveis);

  const { data: tabelas = [] } = useQuery({
    queryKey: ["pxsales", "tabelas-frete"],
    queryFn: () => fnTabelas({ data: {} }),
    staleTime: 300_000,
    enabled: open,
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["pxsales", "clientes", "", "", "ativos"],
    queryFn: () => fnClientes({ data: { situacao: "ativos" } }),
    staleTime: 120_000,
    enabled: open,
  });
  const { data: responsaveis = [] } = useQuery({
    queryKey: ["pxsales", "responsaveis"],
    queryFn: () => fnResp(),
    staleTime: 300_000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (cotacao) {
      setForm({
        ...vazio,
        ...Object.fromEntries(Object.entries(cotacao).map(([k, v]) => [k, v ?? ""])),
        tabela_frete_id: cotacao.tabela_frete_id ?? "",
        cliente_id: cotacao.cliente_id ?? "",
        responsavel_id: cotacao.responsavel_id ?? "",
      });
    } else setForm(vazio);
  }, [open, cotacao]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const dec = (v: string) => v.replace(/[^\d.,]/g, "").replace(",", ".");
  const campo = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  const tabelaSel = useMemo(
    () => (tabelas.find((t) => t.id === form.tabela_frete_id) ?? null) as TabelaFrete | null,
    [tabelas, form.tabela_frete_id],
  );
  const calc = useMemo(() => calcularFrete(tabelaSel, form as any), [tabelaSel, form]);

  async function submit() {
    const cli = clientes.find((c) => c.id === form.cliente_id);
    const empresa = cli ? cli.nome_fantasia || cli.razao_social : form.empresa_nome;
    if (!empresa?.trim()) {
      toast.error("Selecione o cliente ou informe a empresa.");
      return;
    }
    setSaving(true);
    try {
      const res = await save({ data: { ...form, id: cotacao?.id, empresa_nome: empresa, empresa_id: empresaAtiva?.id ?? null } });
      toast.success(cotacao ? "Cotação atualizada" : `Cotação criada — ${brl(calc.valor_total)}`);
      void qc.invalidateQueries({ queryKey: ["pxsales", "cotacoes"] });
      onOpenChange(false);
      onSaved?.(res.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a cotação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cotacao ? `Editar cotação nº ${cotacao.numero}` : "Nova cotação"}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Cliente (cadastro único)</Label>
            <select className={campo} value={form.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
              <option value="">Sem cliente vinculado</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
              ))}
            </select>
          </div>
          {!form.cliente_id && (
            <div className="sm:col-span-2">
              <Label>Empresa *</Label>
              <Input value={form.empresa_nome} onChange={(e) => set("empresa_nome", e.target.value)} />
            </div>
          )}

          <div><Label>Contato</Label><Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} /></div>
          <div><Label>E-mail do contato</Label><Input value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} /></div>

          <div className="sm:col-span-2 border-t pt-3 text-xs font-medium text-muted-foreground uppercase">Trecho</div>
          <div><Label>Cidade de origem</Label><Input value={form.origem_cidade} onChange={(e) => set("origem_cidade", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>UF</Label><Input maxLength={2} value={form.origem_uf} onChange={(e) => set("origem_uf", e.target.value.toUpperCase())} /></div>
            <div><Label>CEP</Label><Input value={form.origem_cep} onChange={(e) => set("origem_cep", e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          </div>
          <div><Label>Cidade de destino</Label><Input value={form.destino_cidade} onChange={(e) => set("destino_cidade", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>UF</Label><Input maxLength={2} value={form.destino_uf} onChange={(e) => set("destino_uf", e.target.value.toUpperCase())} /></div>
            <div><Label>CEP</Label><Input value={form.destino_cep} onChange={(e) => set("destino_cep", e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          </div>

          <div>
            <Label>Tipo de operação</Label>
            <select className={campo} value={form.tipo_operacao} onChange={(e) => set("tipo_operacao", e.target.value)}>
              {TIPOS_OPERACAO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Tabela de frete (PXLog)</Label>
            <select className={campo} value={form.tabela_frete_id} onChange={(e) => set("tabela_frete_id", e.target.value)}>
              <option value="">Sem tabela (valores manuais)</option>
              {tabelas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2 border-t pt-3 text-xs font-medium text-muted-foreground uppercase">Carga</div>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div><Label>Volumes</Label><Input inputMode="numeric" value={form.qtd_volumes} onChange={(e) => set("qtd_volumes", e.target.value.replace(/\D/g, ""))} /></div>
            <div><Label>Peso (kg)</Label><Input inputMode="decimal" value={form.peso} onChange={(e) => set("peso", dec(e.target.value))} /></div>
            <div><Label>Cubagem (m³)</Label><Input inputMode="decimal" value={form.cubagem} onChange={(e) => set("cubagem", dec(e.target.value))} /></div>
          </div>
          <div><Label>Valor da mercadoria (R$)</Label><Input inputMode="decimal" value={form.valor_mercadoria} onChange={(e) => set("valor_mercadoria", dec(e.target.value))} /></div>
          <div><Label>Tipo de mercadoria</Label><Input value={form.tipo_mercadoria} onChange={(e) => set("tipo_mercadoria", e.target.value)} /></div>

          <div className="sm:col-span-2 border-t pt-3 text-xs font-medium text-muted-foreground uppercase">Adicionais</div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div><Label>Pedágio (R$)</Label><Input inputMode="decimal" value={form.pedagio} onChange={(e) => set("pedagio", dec(e.target.value))} /></div>
            <div><Label>Taxas extras (R$)</Label><Input inputMode="decimal" value={form.taxas_extras} onChange={(e) => set("taxas_extras", dec(e.target.value))} /></div>
            <div><Label>GRIS (%)</Label><Input inputMode="decimal" value={form.gris_percentual} onChange={(e) => set("gris_percentual", dec(e.target.value))} /></div>
            <div><Label>Ad-valorem (%)</Label><Input inputMode="decimal" value={form.advalorem_percentual} onChange={(e) => set("advalorem_percentual", dec(e.target.value))} /></div>
            <div><Label>Desconto (%)</Label><Input inputMode="decimal" value={form.desconto_percentual} onChange={(e) => set("desconto_percentual", dec(e.target.value))} /></div>
            <div><Label>Prazo (dias)</Label><Input inputMode="numeric" value={form.prazo_dias} onChange={(e) => set("prazo_dias", e.target.value.replace(/\D/g, ""))} placeholder={String(calc.prazo_dias)} /></div>
          </div>

          <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              <span>Peso cubado: <b className="text-foreground">{calc.peso_cubado} kg</b></span>
              <span>Peso taxado: <b className="text-foreground">{calc.peso_taxado} kg</b></span>
              <span>Frete base: <b className="text-foreground">{brl(calc.valor_base)}</b>{calc.aplicou_minimo ? " (mínimo)" : ""}</span>
              <span>Coleta/entrega: <b className="text-foreground">{brl(calc.valor_coleta + calc.valor_entrega)}</b></span>
              <span>GRIS: <b className="text-foreground">{brl(calc.gris)}</b></span>
              <span>Ad-valorem: <b className="text-foreground">{brl(calc.advalorem)}</b></span>
              <span>Desconto: <b className="text-foreground">-{brl(calc.desconto)}</b></span>
            </div>
            <div className="mt-2 text-lg font-semibold">Total: {brl(calc.valor_total)}</div>
          </div>

          <div><Label>Embarques/mês</Label><Input inputMode="numeric" value={form.frequencia_mensal} onChange={(e) => set("frequencia_mensal", e.target.value.replace(/\D/g, ""))} /></div>
          <div><Label>Condição de pagamento</Label><Input value={form.condicao_pagamento} onChange={(e) => set("condicao_pagamento", e.target.value)} placeholder="Ex.: 28 dias" /></div>
          <div><Label>Validade da cotação</Label><Input type="date" value={form.validade_ate} onChange={(e) => set("validade_ate", e.target.value)} /></div>
          <div>
            <Label>Responsável</Label>
            <select className={campo} value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)}>
              <option value="">Eu mesmo</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />} Salvar cotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
