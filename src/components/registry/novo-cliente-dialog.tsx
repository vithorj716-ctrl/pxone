import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, AlertTriangle, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  findClienteByCnpj,
  linkClienteToSistema,
  lookupCnpj,
  upsertCliente,
  type SistemaKey,
} from "@/lib/px-registry.functions";
import { formatCnpj, isSituacaoOk, isValidCnpj, onlyDigits } from "@/lib/cnpj";
import {
  ClienteForm,
  emptyCliente,
  fromCnpjData,
  fromExisting,
  type ClienteFormState,
} from "./cliente-form";

type Mode = "search" | "edit";

export function NovoClienteDialog({
  open,
  onOpenChange,
  sistema,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sistema: SistemaKey;
  onSaved?: (cliente: any) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [mode, setMode] = useState<Mode>("search");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClienteFormState>(emptyCliente());
  const [existing, setExisting] = useState<any | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [confirmInapta, setConfirmInapta] = useState(false);

  const fnLookup = useServerFn(lookupCnpj);
  const fnFind = useServerFn(findClienteByCnpj);
  const fnUpsert = useServerFn(upsertCliente);
  const fnLink = useServerFn(linkClienteToSistema);

  function reset() {
    setCnpj(""); setMode("search"); setLoading(false); setSaving(false);
    setForm(emptyCliente()); setExisting(null); setReadOnly(false); setConfirmInapta(false);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function buscar() {
    const d = onlyDigits(cnpj);
    if (!isValidCnpj(d)) { toast.error("CNPJ inválido"); return; }
    setLoading(true);
    try {
      const found = await fnFind({ data: { cnpj: d } });
      if (found) {
        setExisting(found);
        setForm(fromExisting(found));
        setMode("edit");
        setReadOnly(true);
        toast.info("Este CNPJ já está cadastrado na plataforma.");
        return;
      }
      const api = await fnLookup({ data: { cnpj: d } });
      setForm(fromCnpjData(api, { ...emptyCliente(), cnpj: d }));
      setMode("edit");
      setReadOnly(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha na consulta");
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    if (!form.razao_social) { toast.error("Razão social obrigatória"); return; }
    if (!form.categorias.length) { toast.error("Selecione ao menos uma categoria"); return; }
    if (!isSituacaoOk(form.situacao_cadastral) && !confirmInapta) {
      toast.error("Confirme o cadastro de empresa em situação irregular");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: form.id ?? undefined,
        cnpj: form.cnpj,
        razao_social: form.razao_social || null,
        nome_fantasia: form.nome_fantasia || null,
        situacao_cadastral: form.situacao_cadastral || null,
        data_abertura: form.data_abertura || null,
        natureza_juridica: form.natureza_juridica || null,
        cnae_principal: form.cnae_principal || null,
        cnae_descricao: form.cnae_descricao || null,
        cep: form.cep || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        contato_nome: form.contato_nome || null,
        contato_cargo: form.contato_cargo || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        observacoes: form.observacoes || null,
        condicao_pagamento: form.condicao_pagamento || null,
        limite_credito: form.limite_credito ? Number(form.limite_credito) : null,
        categorias: form.categorias,
      };
      const saved = await fnUpsert({ data: payload });
      await fnLink({ data: { cliente_id: saved.id, sistema_key: sistema } });
      toast.success(form.id ? "Cliente atualizado" : "Cliente cadastrado");
      onSaved?.(saved);
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "search" ? "Novo cliente" : existing ? "Cliente já cadastrado" : "Confirmar cadastro"}
          </DialogTitle>
        </DialogHeader>

        {mode === "search" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe apenas o CNPJ. O PX Registry consulta automaticamente os dados públicos da empresa.
            </p>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  onBlur={() => setCnpj((v) => (onlyDigits(v).length === 14 ? formatCnpj(v) : v))}
                  onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                  placeholder="00.000.000/0000-00"
                />
                <Button onClick={buscar} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  <span className="ml-2">Buscar Dados</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Antes de consultar a Receita, verificamos se o cliente já existe em qualquer sistema da PX Platform.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {existing && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <div>
                  Este CNPJ já está cadastrado. Você pode visualizar ou editar os dados existentes.
                  {readOnly && (
                    <Button size="sm" variant="ghost" className="ml-2 h-6" onClick={() => setReadOnly(false)}>
                      <Pencil className="size-3 mr-1" /> Editar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!isSituacaoOk(form.situacao_cadastral) && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <div>
                    Empresa com situação <strong>{form.situacao_cadastral}</strong> na Receita Federal.
                    O cadastro requer confirmação explícita.
                  </div>
                </div>
                {!readOnly && (
                  <label className="flex items-center gap-2 pl-6 cursor-pointer">
                    <Checkbox checked={confirmInapta} onCheckedChange={(v) => setConfirmInapta(!!v)} />
                    Confirmo o cadastro mesmo com situação irregular
                  </label>
                )}
              </div>
            )}

            <ClienteForm value={form} onChange={setForm} readOnly={readOnly} />
          </div>
        )}

        <DialogFooter>
          {mode === "edit" && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Fechar</Button>
              {!readOnly && (
                <Button onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                  {form.id ? "Salvar alterações" : "Cadastrar cliente"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
