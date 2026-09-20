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
import { saveLead, listResponsaveis, listPipelineEtapas, ORIGENS_LEAD, type LeadRow } from "@/lib/pxsales-pipeline.functions";
import { formatCnpj, onlyDigits } from "@/lib/cnpj";

const TEMPERATURAS = [
  { v: "frio", l: "Frio" },
  { v: "morno", l: "Morno" },
  { v: "quente", l: "Quente" },
];

const vazio = {
  empresa: "",
  cnpj: "",
  nome_fantasia: "",
  cidade: "",
  uf: "",
  segmento: "",
  origem: "prospeccao",
  contato_nome: "",
  contato_cargo: "",
  contato_telefone: "",
  contato_email: "",
  potencial_mensal: "",
  tipo_carga: "",
  temperatura: "morno",
  etapa: "novo_lead",
  responsavel_id: "",
  proxima_acao: "",
  proxima_acao_em: "",
  observacoes: "",
};

export function LeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: LeadRow | null;
}) {
  const [form, setForm] = useState<Record<string, any>>(vazio);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveLead);
  const { empresa } = useEmpresaAtiva();
  const qc = useQueryClient();

  const fnResp = useServerFn(listResponsaveis);
  const fnEtapas = useServerFn(listPipelineEtapas);
  const { data: responsaveis = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnResp(), staleTime: 300_000 });
  const { data: etapas = [] } = useQuery({ queryKey: ["pxsales", "etapas"], queryFn: () => fnEtapas(), staleTime: 300_000 });

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        ...vazio,
        ...lead,
        cnpj: lead.cnpj ? formatCnpj(lead.cnpj) : "",
        potencial_mensal: lead.potencial_mensal ?? "",
        proxima_acao_em: lead.proxima_acao_em ? lead.proxima_acao_em.slice(0, 16) : "",
        responsavel_id: lead.responsavel_id ?? "",
      });
    } else {
      setForm(vazio);
    }
  }, [open, lead]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.empresa?.trim()) {
      toast.error("Informe a empresa do lead.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: lead?.id,
          empresa_id: empresa?.id ?? null,
          empresa: form.empresa,
          cnpj: form.cnpj ? onlyDigits(form.cnpj) : null,
          nome_fantasia: form.nome_fantasia || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          segmento: form.segmento || null,
          origem: form.origem,
          contato_nome: form.contato_nome || null,
          contato_cargo: form.contato_cargo || null,
          contato_telefone: form.contato_telefone || null,
          contato_email: form.contato_email || null,
          potencial_mensal: form.potencial_mensal,
          tipo_carga: form.tipo_carga || null,
          temperatura: form.temperatura,
          etapa: form.etapa,
          responsavel_id: form.responsavel_id || null,
          proxima_acao: form.proxima_acao || null,
          proxima_acao_em: form.proxima_acao_em ? new Date(form.proxima_acao_em).toISOString() : null,
          observacoes: form.observacoes || null,
        },
      });
      toast.success(lead ? "Lead atualizado" : "Lead cadastrado");
      void qc.invalidateQueries({ queryKey: ["pxsales", "leads"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o lead");
    } finally {
      setSaving(false);
    }
  }

  const campo = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Empresa *</Label>
            <Input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder="Razão social ou nome da empresa" />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label>Nome fantasia</Label>
            <Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Segmento</Label>
            <Input value={form.segmento} onChange={(e) => set("segmento", e.target.value)} placeholder="Indústria, varejo, farma…" />
          </div>
          <div>
            <Label>Origem</Label>
            <select className={campo} value={form.origem} onChange={(e) => set("origem", e.target.value)}>
              {ORIGENS_LEAD.map((o) => (
                <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 border-t border-border pt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            Contato
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={form.contato_cargo} onChange={(e) => set("contato_cargo", e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} />
          </div>

          <div className="sm:col-span-2 border-t border-border pt-3 text-[11px] uppercase tracking-widest text-muted-foreground">
            Qualificação
          </div>
          <div>
            <Label>Potencial mensal (R$)</Label>
            <Input inputMode="decimal" value={form.potencial_mensal} onChange={(e) => set("potencial_mensal", e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} />
          </div>
          <div>
            <Label>Tipo de carga</Label>
            <Input value={form.tipo_carga} onChange={(e) => set("tipo_carga", e.target.value)} />
          </div>
          <div>
            <Label>Temperatura</Label>
            <select className={campo} value={form.temperatura} onChange={(e) => set("temperatura", e.target.value)}>
              {TEMPERATURAS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
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
            <Label>Próxima ação em</Label>
            <Input type="datetime-local" value={form.proxima_acao_em} onChange={(e) => set("proxima_acao_em", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Próxima ação</Label>
            <Input value={form.proxima_acao} onChange={(e) => set("proxima_acao", e.target.value)} placeholder="Ex.: ligar para o responsável de logística" />
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
