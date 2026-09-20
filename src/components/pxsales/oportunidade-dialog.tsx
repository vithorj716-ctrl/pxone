import { useEffect, useState } from "react";
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
import {
  saveOportunidade,
  listResponsaveis,
  listPipelineEtapas,
  type OportunidadeRow,
} from "@/lib/pxsales-pipeline.functions";
import { listSalesClientes } from "@/lib/pxsales-clientes.functions";

const vazio = {
  titulo: "",
  cliente_id: "",
  empresa_nome: "",
  etapa: "qualificacao",
  valor_estimado: "",
  frequencia_mensal: "",
  margem_percentual: "",
  probabilidade: "50",
  previsao_fechamento: "",
  tipo_operacao: "",
  responsavel_id: "",
  observacoes: "",
};

export function OportunidadeDialog({
  open,
  onOpenChange,
  oportunidade,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade?: OportunidadeRow | null;
}) {
  const [form, setForm] = useState<Record<string, any>>(vazio);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveOportunidade);
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();

  const fnResp = useServerFn(listResponsaveis);
  const fnEtapas = useServerFn(listPipelineEtapas);
  const fnClientes = useServerFn(listSalesClientes);
  const { data: responsaveis = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnResp(), staleTime: 300_000 });
  const { data: etapas = [] } = useQuery({ queryKey: ["pxsales", "etapas"], queryFn: () => fnEtapas(), staleTime: 300_000 });
  const { data: clientes = [] } = useQuery({
    queryKey: ["pxsales", "clientes", "", "", "ativos"],
    queryFn: () => fnClientes({ data: { situacao: "ativos" } }),
    staleTime: 120_000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (oportunidade) {
      setForm({
        ...vazio,
        ...oportunidade,
        cliente_id: oportunidade.cliente_id ?? "",
        valor_estimado: String(oportunidade.valor_estimado ?? ""),
        frequencia_mensal: oportunidade.frequencia_mensal ?? "",
        margem_percentual: oportunidade.margem_percentual ?? "",
        probabilidade: String(oportunidade.probabilidade ?? 50),
        previsao_fechamento: oportunidade.previsao_fechamento ?? "",
        responsavel_id: oportunidade.responsavel_id ?? "",
        observacoes: oportunidade.observacoes ?? "",
      });
    } else setForm(vazio);
  }, [open, oportunidade]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const campo = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  async function submit() {
    if (!form.titulo?.trim()) {
      toast.error("Informe o título da oportunidade.");
      return;
    }
    setSaving(true);
    try {
      const cli = clientes.find((c) => c.id === form.cliente_id);
      await save({
        data: {
          id: oportunidade?.id,
          empresa_id: empresa?.id ?? null,
          titulo: form.titulo,
          cliente_id: form.cliente_id || null,
          empresa_nome: cli ? cli.nome_fantasia || cli.razao_social : form.empresa_nome || null,
          etapa: form.etapa,
          valor_estimado: form.valor_estimado,
          frequencia_mensal: form.frequencia_mensal,
          margem_percentual: form.margem_percentual,
          probabilidade: form.probabilidade,
          previsao_fechamento: form.previsao_fechamento || null,
          tipo_operacao: form.tipo_operacao || null,
          responsavel_id: form.responsavel_id || null,
          observacoes: form.observacoes || null,
        },
      });
      toast.success(oportunidade ? "Oportunidade atualizada" : "Oportunidade criada");
      void qc.invalidateQueries({ queryKey: ["pxsales", "oportunidades"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a oportunidade");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oportunidade ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Transferência mensal SP → MG" />
          </div>
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
              <Label>Empresa (texto livre)</Label>
              <Input value={form.empresa_nome ?? ""} onChange={(e) => set("empresa_nome", e.target.value)} />
            </div>
          )}
          <div>
            <Label>Etapa</Label>
            <select className={campo} value={form.etapa} onChange={(e) => set("etapa", e.target.value)}>
              {etapas.map((e) => <option key={e.chave} value={e.chave}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Responsável</Label>
            <select className={campo} value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)}>
              <option value="">Eu mesmo</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <div>
            <Label>Valor estimado (R$/mês)</Label>
            <Input inputMode="decimal" value={form.valor_estimado} onChange={(e) => set("valor_estimado", e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} />
          </div>
          <div>
            <Label>Embarques/mês</Label>
            <Input inputMode="numeric" value={form.frequencia_mensal} onChange={(e) => set("frequencia_mensal", e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <Label>Margem (%)</Label>
            <Input inputMode="decimal" value={form.margem_percentual} onChange={(e) => set("margem_percentual", e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} />
          </div>
          <div>
            <Label>Probabilidade (%)</Label>
            <Input inputMode="numeric" value={form.probabilidade} onChange={(e) => set("probabilidade", e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <div>
            <Label>Previsão de fechamento</Label>
            <Input type="date" value={form.previsao_fechamento} onChange={(e) => set("previsao_fechamento", e.target.value)} />
          </div>
          <div>
            <Label>Tipo de operação</Label>
            <Input value={form.tipo_operacao} onChange={(e) => set("tipo_operacao", e.target.value)} placeholder="Transferência, distribuição, dedicado…" />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
