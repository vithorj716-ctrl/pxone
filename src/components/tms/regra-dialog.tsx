// Editor dinâmico de uma regra comercial: os campos exibidos dependem do modo escolhido.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveRegraTabela, saveServico, saveRota } from "@/lib/tms-tabelas.functions";
import { BASES, MODOS, TIPOS_REGRA } from "@/pxlog/regra-engine";

const campo = "h-10 w-full rounded-md bg-background ring-1 ring-border px-3 text-sm";

export type ServicoOpt = { id: string; nome: string };
export type RotaOpt = { id: string; nome: string };

export function RegraDialog({
  open, onOpenChange, tabelaId, regra, servicos, rotas, onSaved, onEntidades,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tabelaId: string;
  regra: any | null;
  servicos: ServicoOpt[];
  rotas: RotaOpt[];
  onSaved: () => void;
  onEntidades: () => void;
}) {
  const [f, setF] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);
  const [novoServico, setNovoServico] = useState(false);
  const [novaRota, setNovaRota] = useState(false);

  useEffect(() => {
    setF(
      regra ?? {
        nome: "", tipo: "taxa", modo: "valor_fixo", valor: "", base_calculo: "nenhuma",
        unidade: "", servico_id: "", rota_id: "", faixa_campo: "", faixa_min: "", faixa_max: "",
        valor_minimo: "", valor_maximo: "", ordem: 100, ativo: true,
      },
    );
  }, [regra, open]);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const modo = String(f["modo"] ?? "valor_fixo");
  const exigeBase = useMemo(() => MODOS.find((m) => m.value === modo)?.exigeBase ?? false, [modo]);
  const fnSave = useServerFn(saveRegraTabela);

  async function salvar() {
    setSalvando(true);
    try {
      await fnSave({ data: { ...f, tabela_id: tabelaId, id: regra?.id } });
      toast.success("Regra salva.");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a regra.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{regra ? "Editar regra" : "Adicionar regra"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de cobrança</Label>
                <select className={campo} value={modo} onChange={(e) => set("modo", e.target.value)}>
                  {MODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Classificação</Label>
                <select className={campo} value={f["tipo"] ?? "taxa"} onChange={(e) => set("tipo", e.target.value)}>
                  {TIPOS_REGRA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Nome</Label>
              <Input value={f["nome"] ?? ""} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: GRIS, Pedágio, Taxa de coleta" />
            </div>

            {exigeBase && (
              <div>
                <Label>Base de cálculo</Label>
                <select className={campo} value={f["base_calculo"] ?? "nenhuma"} onChange={(e) => set("base_calculo", e.target.value)}>
                  {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}

            {modo !== "faixa" && (
              <div>
                <Label>
                  Valor {modo === "percentual" ? "(%)" : modo === "por_kg" ? "(R$/kg)" : modo === "por_m3" ? "(R$/m³)" : modo === "por_km" ? "(R$/km)" : modo === "por_volume" ? "(R$/volume)" : "(R$)"}
                </Label>
                <Input value={f["valor"] ?? ""} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" inputMode="decimal" />
                <p className="text-[11px] text-muted-foreground mt-1">Aceita 0,05 ou 0.05. Deixar vazio significa “não configurado”.</p>
              </div>
            )}

            {f["tipo"] === "servico" && (
              <div>
                <Label>Serviço</Label>
                <div className="flex gap-2">
                  <select className={campo} value={f["servico_id"] ?? ""} onChange={(e) => set("servico_id", e.target.value)}>
                    <option value="">Selecione…</option>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNovoServico(true)}>
                    <Plus className="size-3.5 mr-1" /> cadastrar
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label>Rota (opcional)</Label>
              <div className="flex gap-2">
                <select className={campo} value={f["rota_id"] ?? ""} onChange={(e) => set("rota_id", e.target.value)}>
                  <option value="">Qualquer rota</option>
                  {rotas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNovaRota(true)}>
                  <Plus className="size-3.5 mr-1" /> cadastrar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Faixa por</Label>
                <select className={campo} value={f["faixa_campo"] ?? ""} onChange={(e) => set("faixa_campo", e.target.value)}>
                  <option value="">Sem faixa</option>
                  {BASES.filter((b) => b.value !== "nenhuma" && b.value !== "subtotal").map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>De</Label>
                <Input value={f["faixa_min"] ?? ""} onChange={(e) => set("faixa_min", e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Até</Label>
                <Input value={f["faixa_max"] ?? ""} onChange={(e) => set("faixa_max", e.target.value)} inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Piso (R$)</Label>
                <Input value={f["valor_minimo"] ?? ""} onChange={(e) => set("valor_minimo", e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Teto (R$)</Label>
                <Input value={f["valor_maximo"] ?? ""} onChange={(e) => set("valor_maximo", e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input value={f["ordem"] ?? 100} onChange={(e) => set("ordem", e.target.value)} inputMode="numeric" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg ring-1 ring-border p-3">
              <span className="text-xs">Regra ativa</span>
              <Switch checked={f["ativo"] !== false} onCheckedChange={(v) => set("ativo", v)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="size-4 mr-1 animate-spin" />} Salvar regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CadastroRapido
        open={novoServico}
        onOpenChange={setNovoServico}
        titulo="Novo serviço"
        campos={[
          { k: "nome", label: "Nome" },
          { k: "unidade", label: "Unidade", placeholder: "un, hora, kg…" },
          { k: "descricao", label: "Descrição" },
        ]}
        onSalvar={async (dados) => {
          const r = await (saveServico as any)({ data: dados });
          set("servico_id", r.id);
          set("tipo", "servico");
          onEntidades();
        }}
      />

      <CadastroRapido
        open={novaRota}
        onOpenChange={setNovaRota}
        titulo="Nova rota"
        campos={[
          { k: "nome", label: "Nome da rota", placeholder: "Goiânia → Brasília" },
          { k: "origem_cidade", label: "Cidade origem" },
          { k: "origem_uf", label: "UF origem" },
          { k: "destino_cidade", label: "Cidade destino" },
          { k: "destino_uf", label: "UF destino" },
          { k: "distancia_km", label: "Distância (km)" },
        ]}
        onSalvar={async (dados) => {
          const r = await (saveRota as any)({ data: dados });
          set("rota_id", r.id);
          onEntidades();
        }}
      />
    </>
  );
}

export function CadastroRapido({
  open, onOpenChange, titulo, campos, onSalvar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  campos: { k: string; label: string; placeholder?: string }[];
  onSalvar: (dados: Record<string, string>) => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) setV({}); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {campos.map((c) => (
            <div key={c.k}>
              <Label>{c.label}</Label>
              <Input value={v[c.k] ?? ""} placeholder={c.placeholder} onChange={(e) => setV((p) => ({ ...p, [c.k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={salvando}
            onClick={async () => {
              setSalvando(true);
              try {
                await onSalvar(v);
                toast.success("Cadastrado e selecionado.");
                onOpenChange(false);
              } catch (e: any) {
                toast.error(e?.message ?? "Não foi possível cadastrar.");
              } finally {
                setSalvando(false);
              }
            }}
          >
            {salvando && <Loader2 className="size-4 mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
