import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Plus, Pencil, Trash2, ArrowLeft, Users, Star } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_ENDERECO, SETORES_CONTATO, RESTRICOES_PADRAO,
  listEnderecos, upsertEndereco, deleteEndereco,
  listContatos, upsertContato, deleteContato,
  type EnderecoInput, type ContatoInput,
} from "@/lib/px-enderecos.functions";

type EnderecoRow = EnderecoInput & { id: string };
type ContatoRow = ContatoInput & { id: string };

function emptyEndereco(cliente_id: string): EnderecoInput {
  return {
    cliente_id, tipo: "filial", apelido: "", cep: "", logradouro: "", numero: "",
    complemento: "", bairro: "", cidade: "", uf: "", ponto_referencia: "",
    observacoes: "", janela_recebimento: "", restricoes: [],
    is_padrao_remetente: false, is_padrao_destinatario: false,
  };
}

function emptyContato(cliente_id: string, endereco_id: string | null): ContatoInput {
  return {
    cliente_id, endereco_id, setor: "recebimento", nome: "", cargo: "",
    telefone: "", whatsapp: "", email: "", is_principal: false,
  };
}

export function EnderecosTab({ clienteId }: { clienteId: string }) {
  const fnList = useServerFn(listEnderecos);
  const fnUpsert = useServerFn(upsertEndereco);
  const fnDelete = useServerFn(deleteEndereco);
  const [rows, setRows] = useState<EnderecoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EnderecoInput | null>(null);

  async function refresh() {
    setLoading(true);
    try { setRows(await fnList({ data: { cliente_id: clienteId } }) as any); }
    catch (e: any) { toast.error(e?.message || "Falha ao carregar endereços"); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [clienteId]);

  async function save() {
    if (!editing) return;
    try {
      await fnUpsert({ data: editing });
      toast.success("Endereço salvo");
      setEditing(null);
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha"); }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este endereço? Os contatos vinculados também serão removidos.")) return;
    try { await fnDelete({ data: { id } }); toast.success("Endereço removido"); refresh(); }
    catch (e: any) { toast.error(e?.message || "Falha"); }
  }

  if (editing) {
    return (
      <EnderecoEditor
        value={editing}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={save}
        clienteId={clienteId}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Cadastre múltiplos endereços do cliente. Ao gerar uma minuta, basta selecionar o endereço — todos os dados são preenchidos automaticamente.
        </p>
        <Button size="sm" onClick={() => setEditing(emptyEndereco(clienteId))}>
          <Plus className="size-3.5 mr-1" /> Novo endereço
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-md">
          Nenhum endereço cadastrado. Clique em "Novo endereço".
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {r.apelido || TIPOS_ENDERECO.find(t => t.value === r.tipo)?.label || r.tipo}
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {TIPOS_ENDERECO.find(t => t.value === r.tipo)?.label || r.tipo}
                    </span>
                    {r.is_padrao_remetente && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">Remetente padrão</span>}
                    {r.is_padrao_destinatario && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Destinatário padrão</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[r.logradouro, r.numero, r.bairro].filter(Boolean).join(", ") || "—"} • {[r.cidade, r.uf].filter(Boolean).join("/")} {r.cep ? `• CEP ${r.cep}` : ""}
                  </div>
                  {r.restricoes && r.restricoes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.restricoes.map(x => (
                        <span key={x} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">{x}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)} title="Editar"><Pencil className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)} title="Remover"><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              <ContatosList enderecoId={r.id} clienteId={clienteId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnderecoEditor({
  value, onChange, onCancel, onSave, clienteId,
}: {
  value: EnderecoInput;
  onChange: (v: EnderecoInput) => void;
  onCancel: () => void;
  onSave: () => void;
  clienteId: string;
}) {
  const set = <K extends keyof EnderecoInput>(k: K, v: EnderecoInput[K]) => onChange({ ...value, [k]: v });
  const toggleRestricao = (r: string, on: boolean) => {
    const cur = value.restricoes ?? [];
    set("restricoes", on ? Array.from(new Set([...cur, r])) : cur.filter(x => x !== r));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft className="size-3.5 mr-1" /> Voltar</Button>
        <h4 className="text-sm font-medium">{value.id ? "Editar endereço" : "Novo endereço"}</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Tipo</Label>
          <Select value={value.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_ENDERECO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-[11px] uppercase">Apelido / identificação</Label>
          <Input value={value.apelido ?? ""} onChange={(e) => set("apelido", e.target.value)} placeholder="Ex.: Filial Goiânia, CD Brasília, Hospital Santa Helena" />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] uppercase">CEP</Label>
          <Input value={value.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase">Logradouro</Label>
          <Input value={value.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">Número</Label>
          <Input value={value.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase">Complemento</Label>
          <Input value={value.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase">Bairro</Label>
          <Input value={value.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-[11px] uppercase">Cidade</Label>
          <Input value={value.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase">UF</Label>
          <Input value={value.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase">Ponto de referência</Label>
          <Input value={value.ponto_referencia ?? ""} onChange={(e) => set("ponto_referencia", e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] uppercase">Janela de recebimento</Label>
          <Input value={value.janela_recebimento ?? ""} onChange={(e) => set("janela_recebimento", e.target.value)} placeholder="Ex.: Seg-Sex 8h às 17h" />
        </div>

        <div className="space-y-1 sm:col-span-4">
          <Label className="text-[11px] uppercase">Observações de coleta / entrega</Label>
          <Textarea rows={2} value={value.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
        </div>

        <div className="space-y-2 sm:col-span-4">
          <Label className="text-[11px] uppercase">Restrições</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RESTRICOES_PADRAO.map((r) => {
              const checked = (value.restricoes ?? []).includes(r);
              return (
                <label key={r} className="flex items-center gap-2 text-xs rounded-md border border-border px-2 py-1.5 cursor-pointer hover:bg-white/5">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggleRestricao(r, !!v)} />
                  {r}
                </label>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={!!value.is_padrao_remetente} onCheckedChange={(v) => set("is_padrao_remetente", !!v)} />
            Remetente padrão deste cliente
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={!!value.is_padrao_destinatario} onCheckedChange={(v) => set("is_padrao_destinatario", !!v)} />
            Destinatário padrão deste cliente
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave}>Salvar endereço</Button>
      </div>

      {value.id && <ContatosEditor enderecoId={value.id} clienteId={clienteId} />}
    </div>
  );
}

function ContatosList({ enderecoId, clienteId }: { enderecoId: string; clienteId: string }) {
  const fnList = useServerFn(listContatos);
  const [rows, setRows] = useState<ContatoRow[]>([]);
  useEffect(() => {
    fnList({ data: { endereco_id: enderecoId } }).then(setRows as any).catch(() => {});
    // eslint-disable-next-line
  }, [enderecoId]);
  if (!rows.length) return (
    <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/50">
      <Users className="size-3" /> Nenhum contato neste endereço — edite o endereço para adicionar.
    </div>
  );
  return (
    <div className="pt-2 border-t border-border/50 space-y-1">
      <div className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><Users className="size-3" /> Contatos</div>
      {rows.map((c) => (
        <div key={c.id} className="text-xs flex items-center gap-2 flex-wrap">
          {c.is_principal && <Star className="size-3 text-amber-400" />}
          <span className="font-medium">{c.nome}</span>
          <span className="text-muted-foreground">• {SETORES_CONTATO.find(s => s.value === c.setor)?.label || c.setor}</span>
          {c.telefone && <span className="text-muted-foreground">• {c.telefone}</span>}
          {c.email && <span className="text-muted-foreground">• {c.email}</span>}
        </div>
      ))}
    </div>
  );
}

function ContatosEditor({ enderecoId, clienteId }: { enderecoId: string; clienteId: string }) {
  const fnList = useServerFn(listContatos);
  const fnUpsert = useServerFn(upsertContato);
  const fnDelete = useServerFn(deleteContato);
  const [rows, setRows] = useState<ContatoRow[]>([]);
  const [draft, setDraft] = useState<ContatoInput | null>(null);

  async function refresh() {
    try { setRows(await fnList({ data: { endereco_id: enderecoId } }) as any); } catch {}
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [enderecoId]);

  async function save() {
    if (!draft) return;
    try { await fnUpsert({ data: draft }); toast.success("Contato salvo"); setDraft(null); refresh(); }
    catch (e: any) { toast.error(e?.message || "Falha"); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remover este contato?")) return;
    try { await fnDelete({ data: { id } }); refresh(); } catch (e: any) { toast.error(e?.message || "Falha"); }
  }

  return (
    <div className="space-y-2 border border-border rounded-md p-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2"><Users className="size-4" /> Contatos deste endereço</h4>
        {!draft && (
          <Button size="sm" variant="outline" onClick={() => setDraft(emptyContato(clienteId, enderecoId))}>
            <Plus className="size-3.5 mr-1" /> Adicionar contato
          </Button>
        )}
      </div>

      {rows.length === 0 && !draft && (
        <p className="text-xs text-muted-foreground py-2">Nenhum contato cadastrado.</p>
      )}

      <div className="space-y-1">
        {rows.map((c) => (
          <div key={c.id} className="text-xs flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2 flex-wrap">
              {c.is_principal && <Star className="size-3 text-amber-400" />}
              <span className="font-medium">{c.nome}</span>
              <span className="text-muted-foreground">{SETORES_CONTATO.find(s => s.value === c.setor)?.label || c.setor}</span>
              {c.telefone && <span className="text-muted-foreground">• {c.telefone}</span>}
              {c.whatsapp && <span className="text-muted-foreground">• Whats {c.whatsapp}</span>}
              {c.email && <span className="text-muted-foreground">• {c.email}</span>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setDraft(c)}><Pencil className="size-3" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="size-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase">Setor</Label>
              <Select value={draft.setor} onValueChange={(v) => setDraft({ ...draft, setor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETORES_CONTATO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] uppercase">Nome</Label>
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase">Cargo</Label>
              <Input value={draft.cargo ?? ""} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase">Telefone</Label>
              <Input value={draft.telefone ?? ""} onChange={(e) => setDraft({ ...draft, telefone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase">WhatsApp</Label>
              <Input value={draft.whatsapp ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] uppercase">E-mail</Label>
              <Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="sm:col-span-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={!!draft.is_principal} onCheckedChange={(v) => setDraft({ ...draft, is_principal: !!v })} />
                Contato principal deste endereço
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button size="sm" onClick={save}>Salvar contato</Button>
          </div>
        </div>
      )}
    </div>
  );
}
