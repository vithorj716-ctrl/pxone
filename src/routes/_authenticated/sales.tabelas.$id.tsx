import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2, Calculator, Share2, Copy, Upload } from "lucide-react";
import { ImportarConfigTabelaDialog } from "@/components/pxsales/importar-config-tabela-dialog";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getTabela,
  getVersao,
  saveVersao,
  salvarComponentes,
  publicarVersao,
  novaVersao,
  calcularCotacao,
} from "@/lib/pxsales-tabelas.functions";
import { salvarAcessoPortal, listAcessosPortal } from "@/lib/pxsales-portal-cliente.functions";
import { COMPONENTES_CATALOGO, ORDEM_PADRAO, type Componente } from "@/pxsales/tabela-engine";

export const Route = createFileRoute("/_authenticated/sales/tabelas/$id")({
  head: () => ({
    meta: [
      { title: "PXSales — Construtor de tabela | Grupo PX" },
      { name: "description", content: "Monte os componentes, faixas e vigências da tabela comercial do cliente." },
      { property: "og:title", content: "PXSales — Construtor de tabela" },
      { property: "og:description", content: "Componentes, faixas de peso, taxas e versões da tabela comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TabelaDetalhe,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type CampoDef = { k: string; label: string; tipo: "num" | "text" | "select"; opcoes?: { v: string; l: string }[] };

const MODOS_TAXA = [
  { v: "fixo", l: "Valor fixo" },
  { v: "percentual", l: "Percentual" },
  { v: "por_volume", l: "Por volume" },
  { v: "por_kg", l: "Por kg" },
];
const BASES = [
  { v: "mercadoria", l: "Valor da mercadoria" },
  { v: "frete", l: "Frete" },
  { v: "subtotal", l: "Subtotal" },
];

function camposDe(tipo: string): CampoDef[] {
  switch (tipo) {
    case "frete_base":
      return [
        { k: "modo", label: "Forma de cobrança", tipo: "select", opcoes: [
          { v: "fixo", l: "Valor fixo" }, { v: "por_kg", l: "Por kg" }, { v: "por_m3", l: "Por m³" }, { v: "maior", l: "Maior entre kg e m³" },
        ] },
        { k: "valor", label: "Valor", tipo: "num" },
        { k: "valor_m3", label: "Valor por m³ (modo maior)", tipo: "num" },
        { k: "valor_minimo", label: "Valor mínimo", tipo: "num" },
        { k: "rota", label: "Rota / trecho", tipo: "text" },
        { k: "servico", label: "Serviço", tipo: "text" },
        { k: "modalidade", label: "Modalidade", tipo: "text" },
      ];
    case "cubagem":
      return [
        { k: "fator", label: "Fator de cubagem (padrão 300)", tipo: "num" },
        { k: "regra", label: "Peso taxado", tipo: "select", opcoes: [
          { v: "maior", l: "Maior entre real e cubado" }, { v: "real", l: "Sempre peso real" }, { v: "cubado", l: "Sempre cubado" },
        ] },
      ];
    case "excedente_peso":
      return [
        { k: "peso_inicial", label: "Peso incluído (kg)", tipo: "num" },
        { k: "modo", label: "Cobrança do excedente", tipo: "select", opcoes: [
          { v: "por_kg", l: "Por kg excedente" }, { v: "fixo", l: "Valor fixo" }, { v: "percentual", l: "% sobre o frete" },
        ] },
        { k: "valor", label: "Valor", tipo: "num" },
      ];
    case "pedagio":
      return [
        { k: "modo", label: "Forma de cobrança", tipo: "select", opcoes: [
          { v: "fixo", l: "Valor fixo" }, { v: "por_eixo", l: "Por eixo" }, { v: "por_100kg", l: "Por 100 kg" }, { v: "percentual", l: "% sobre o frete" },
        ] },
        { k: "valor", label: "Valor", tipo: "num" },
        { k: "minimo", label: "Mínimo", tipo: "num" },
        { k: "maximo", label: "Máximo", tipo: "num" },
      ];
    case "gris":
    case "advalorem":
      return [
        { k: "percentual", label: "Percentual (%)", tipo: "num" },
        { k: "base", label: "Base de cálculo", tipo: "select", opcoes: BASES },
        { k: "minimo", label: "Mínimo", tipo: "num" },
        { k: "maximo", label: "Máximo", tipo: "num" },
      ];
    case "taxa_espera":
      return [
        { k: "valor", label: "Valor por hora", tipo: "num" },
        { k: "minimo", label: "Mínimo", tipo: "num" },
        { k: "maximo", label: "Máximo", tipo: "num" },
      ];
    case "taxa_estadia":
      return [
        { k: "valor", label: "Valor por diária", tipo: "num" },
        { k: "minimo", label: "Mínimo", tipo: "num" },
        { k: "maximo", label: "Máximo", tipo: "num" },
      ];
    case "frete_minimo":
      return [
        { k: "modo", label: "Como calcular o mínimo", tipo: "select", opcoes: [
          { v: "fixo", l: "Valor fixo" }, { v: "por_kg", l: "Por kg taxado" }, { v: "faixa", l: "Por faixa de peso" },
        ] },
        { k: "valor", label: "Valor do mínimo", tipo: "num" },
        { k: "aplicar_em", label: "Aplicar sobre", tipo: "select", opcoes: [
          { v: "frete", l: "Frete (sem adicionais)" }, { v: "total", l: "Total da cotação" },
        ] },
      ];
    case "faixa_peso":
      return [];

    default:
      return [
        { k: "modo", label: "Forma de cobrança", tipo: "select", opcoes: MODOS_TAXA },
        { k: "valor", label: "Valor / percentual", tipo: "num" },
        { k: "base", label: "Base (se percentual)", tipo: "select", opcoes: BASES },
        { k: "minimo", label: "Mínimo", tipo: "num" },
        { k: "maximo", label: "Máximo", tipo: "num" },
      ];
  }
}

function TabelaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [versaoId, setVersaoId] = useState<string>("");
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [selecionado, setSelecionado] = useState<string>("");
  const [sim, setSim] = useState<Record<string, any>>({ peso: "100", cubagem: "0.5", qtd_volumes: "2", valor_mercadoria: "5000" });
  const [resultado, setResultado] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchTabela = useServerFn(getTabela);
  const fetchVersao = useServerFn(getVersao);
  const salvarComps = useServerFn(salvarComponentes);
  const publicar = useServerFn(publicarVersao);
  const criarVersao = useServerFn(novaVersao);
  const salvarV = useServerFn(saveVersao);
  const calcular = useServerFn(calcularCotacao);

  const { data: tabela, isLoading } = useQuery({
    queryKey: ["pxsales", "tabela", id],
    queryFn: () => fetchTabela({ data: { id } }),
  });

  useEffect(() => {
    const vs = (tabela as any)?.versoes ?? [];
    if (vs.length && !versaoId) setVersaoId(vs[0].id);
  }, [tabela, versaoId]);

  const { data: versaoData } = useQuery({
    queryKey: ["pxsales", "tabela-versao", versaoId],
    queryFn: () => fetchVersao({ data: { id: versaoId } }),
    enabled: !!versaoId,
  });

  useEffect(() => {
    if (versaoData) setComponentes(versaoData.componentes ?? []);
  }, [versaoData]);

  const publicada = versaoData?.versao?.status === "publicada";
  const compSel = componentes.find((c) => c.codigo === selecionado) ?? null;

  function alternarComponente(tipo: string, codigo: string, nome: string, ativo: boolean) {
    setComponentes((prev) => {
      const existente = prev.find((c) => c.codigo === codigo);
      if (existente) return prev.map((c) => (c.codigo === codigo ? { ...c, ativo } : c));
      if (!ativo) return prev;
      return [
        ...prev,
        {
          codigo,
          tipo,
          nome,
          ativo: true,
          ordem: ORDEM_PADRAO.indexOf(codigo) >= 0 ? ORDEM_PADRAO.indexOf(codigo) : prev.length + 50,
          config: {},
          faixas: [],
        },
      ];
    });
    if (ativo) setSelecionado(codigo);
  }

  function setConfig(codigo: string, k: string, v: any) {
    setComponentes((prev) =>
      prev.map((c) => (c.codigo === codigo ? { ...c, config: { ...(c.config ?? {}), [k]: v } } : c)),
    );
  }

  function setFaixas(codigo: string, faixas: any[]) {
    setComponentes((prev) => prev.map((c) => (c.codigo === codigo ? { ...c, faixas } : c)));
  }

  async function onSalvar() {
    setSalvando(true);
    try {
      await salvarComps({ data: { versao_id: versaoId, componentes } });
      toast.success("Componentes salvos.");
      qc.invalidateQueries({ queryKey: ["pxsales", "tabela-versao", versaoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function onPublicar() {
    try {
      await publicar({ data: { versao_id: versaoId } });
      toast.success("Versão publicada e vigente.");
      qc.invalidateQueries({ queryKey: ["pxsales", "tabela", id] });
      qc.invalidateQueries({ queryKey: ["pxsales", "tabela-versao", versaoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível publicar.");
    }
  }

  async function onNovaVersao() {
    try {
      const r = await criarVersao({ data: { tabela_id: id } });
      toast.success("Nova versão criada a partir da atual.");
      await qc.invalidateQueries({ queryKey: ["pxsales", "tabela", id] });
      setVersaoId(r.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível criar a versão.");
    }
  }

  async function onCalcular() {
    try {
      const r = await calcular({ data: { versao_id: versaoId, ...sim } });
      setResultado(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível calcular.");
    }
  }

  const grupos = useMemo(() => Array.from(new Set(COMPONENTES_CATALOGO.map((c) => c.grupo))), []);

  if (isLoading) {
    return (
      <PxSalesShell title="Tabela comercial">
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      </PxSalesShell>
    );
  }

  const t: any = tabela;

  return (
    <PxSalesShell
      title={t?.tabela?.nome ?? "Tabela comercial"}
      subtitle="Escolha os componentes, configure cada regra e publique a versão"
      headerActions={
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-1" /> Importar
          </Button>
          <Button size="sm" variant="secondary" onClick={onNovaVersao}>
            <Copy className="size-4 mr-1" /> Nova versão
          </Button>
          <Button size="sm" variant="secondary" onClick={onSalvar} disabled={salvando || publicada}>
            {salvando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />} Salvar
          </Button>
          <Button size="sm" onClick={onPublicar} disabled={publicada}>
            <Send className="size-4 mr-1" /> Publicar
          </Button>
        </div>
      }
    >
      <ImportarConfigTabelaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        componentesAtuais={componentes}
        nomeTabela={(tabela as any)?.tabela?.nome ?? "tabela"}
        bloqueado={publicada}
        onAplicar={(comps) => {
          setComponentes(comps);
          setSelecionado(comps[0]?.codigo ?? "");
        }}
      />

      <Link to="/sales/tabelas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline mb-3">
        <ArrowLeft className="size-3.5" /> Voltar para tabelas
      </Link>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          className="h-9 rounded-md bg-background ring-1 ring-border px-3 text-sm"
          value={versaoId}
          onChange={(e) => setVersaoId(e.target.value)}
        >
          {(t?.versoes ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              Versão {v.versao} · {v.status} · desde {v.vigencia_inicio}
            </option>
          ))}
        </select>
        {publicada && (
          <span className="text-[11px] text-amber-600">
            Versão publicada é imutável — crie uma nova versão para alterar as regras.
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* catálogo */}
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-3 space-y-3 h-fit">
          <div className="text-xs font-medium">Componentes da tabela</div>
          {grupos.map((g) => (
            <div key={g}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{g}</div>
              <div className="space-y-1">
                {COMPONENTES_CATALOGO.filter((c) => c.grupo === g).map((c) => {
                  const atual = componentes.find((x) => x.codigo === c.codigo);
                  return (
                    <div
                      key={c.codigo}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${
                        selecionado === c.codigo ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                      onClick={() => atual?.ativo && setSelecionado(c.codigo)}
                    >
                      <div className="min-w-0">
                        <div className="text-xs truncate">{c.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{c.descricao}</div>
                      </div>
                      <Switch
                        checked={!!atual?.ativo}
                        disabled={publicada}
                        onCheckedChange={(v) => alternarComponente(c.tipo, c.codigo, c.nome, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {/* configuração do componente */}
          <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
            {!compSel ? (
              <p className="text-xs text-muted-foreground">
                Ative um componente à esquerda e clique nele para configurar a regra.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-sm font-medium">{compSel.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {COMPONENTES_CATALOGO.find((c) => c.codigo === compSel.codigo)?.descricao}
                    </div>
                  </div>
                  <Input
                    className="h-8 w-52"
                    value={compSel.nome}
                    disabled={publicada}
                    onChange={(e) =>
                      setComponentes((prev) =>
                        prev.map((c) => (c.codigo === compSel.codigo ? { ...c, nome: e.target.value } : c)),
                      )
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {camposDe(String(compSel.tipo)).map((f) => (
                    <div key={f.k}>
                      <Label className="text-[11px]">{f.label}</Label>
                      {f.tipo === "select" ? (
                        <select
                          className="h-9 w-full rounded-md bg-background ring-1 ring-border px-2 text-sm"
                          disabled={publicada}
                          value={String(compSel.config?.[f.k] ?? f.opcoes?.[0]?.v ?? "")}
                          onChange={(e) => setConfig(compSel.codigo, f.k, e.target.value)}
                        >
                          {f.opcoes?.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          className="h-9"
                          disabled={publicada}
                          inputMode={f.tipo === "num" ? "decimal" : "text"}
                          value={String(compSel.config?.[f.k] ?? "")}
                          onChange={(e) =>
                            setConfig(compSel.codigo, f.k, f.tipo === "num" ? e.target.value.replace(",", ".") : e.target.value)
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>

                {(compSel.tipo === "faixa_peso" || (compSel.tipo === "frete_minimo" && compSel.config?.modo === "faixa")) && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium">Faixas de peso</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={publicada}
                        onClick={() =>
                          setFaixas(compSel.codigo, [
                            ...(compSel.faixas ?? []),
                            { peso_min: 0, peso_max: 10, tipo_valor: "fixo", valor: 0, valor_minimo: 0 },
                          ])
                        }
                      >
                        <Plus className="size-3.5 mr-1" /> Faixa
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(compSel.faixas ?? []).map((f, idx) => (
                        <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">De (kg)</Label>
                            <Input
                              className="h-9"
                              disabled={publicada}
                              value={String(f.peso_min)}
                              onChange={(e) => {
                                const arr = [...(compSel.faixas ?? [])];
                                arr[idx] = { ...f, peso_min: Number(e.target.value.replace(",", ".")) || 0 };
                                setFaixas(compSel.codigo, arr);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Até (kg)</Label>
                            <Input
                              className="h-9"
                              disabled={publicada}
                              value={String(f.peso_max)}
                              onChange={(e) => {
                                const arr = [...(compSel.faixas ?? [])];
                                arr[idx] = { ...f, peso_max: Number(e.target.value.replace(",", ".")) || 0 };
                                setFaixas(compSel.codigo, arr);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Tipo</Label>
                            <select
                              className="h-9 w-full rounded-md bg-background ring-1 ring-border px-2 text-sm"
                              disabled={publicada}
                              value={f.tipo_valor}
                              onChange={(e) => {
                                const arr = [...(compSel.faixas ?? [])];
                                arr[idx] = { ...f, tipo_valor: e.target.value as any };
                                setFaixas(compSel.codigo, arr);
                              }}
                            >
                              <option value="fixo">Fixo</option>
                              <option value="por_kg">Por kg</option>
                              <option value="percentual">% mercadoria</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Valor</Label>
                            <Input
                              className="h-9"
                              disabled={publicada}
                              value={String(f.valor)}
                              onChange={(e) => {
                                const arr = [...(compSel.faixas ?? [])];
                                arr[idx] = { ...f, valor: Number(e.target.value.replace(",", ".")) || 0 };
                                setFaixas(compSel.codigo, arr);
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Mínimo</Label>
                            <Input
                              className="h-9"
                              disabled={publicada}
                              value={String(f.valor_minimo)}
                              onChange={(e) => {
                                const arr = [...(compSel.faixas ?? [])];
                                arr[idx] = { ...f, valor_minimo: Number(e.target.value.replace(",", ".")) || 0 };
                                setFaixas(compSel.codigo, arr);
                              }}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={publicada}
                            onClick={() => setFaixas(compSel.codigo, (compSel.faixas ?? []).filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* vigência e observações */}
          <VigenciaBox versaoId={versaoId} versao={versaoData?.versao} onSaved={() => qc.invalidateQueries({ queryKey: ["pxsales", "tabela", id] })} salvar={salvarV} />

          {/* simulador */}
          <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
            <div className="text-xs font-medium mb-3 flex items-center gap-1.5">
              <Calculator className="size-3.5" /> Simulador da tabela
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { k: "peso", l: "Peso (kg)" },
                { k: "cubagem", l: "Cubagem (m³)" },
                { k: "qtd_volumes", l: "Volumes" },
                { k: "valor_mercadoria", l: "Valor mercadoria" },
                { k: "eixos", l: "Eixos" },
                { k: "horas_espera", l: "Horas de espera" },
                { k: "diarias", l: "Diárias" },
                { k: "desconto_percentual", l: "Desconto (%)" },
              ].map((f) => (
                <div key={f.k}>
                  <Label className="text-[10px]">{f.l}</Label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    value={String(sim[f.k] ?? "")}
                    onChange={(e) => setSim((s) => ({ ...s, [f.k]: e.target.value.replace(",", ".") }))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg ring-1 ring-border p-3">
              <div className="text-[10px] text-muted-foreground mb-2">
                Dimensões dos volumes (em metros) — quando preenchidas, a cubagem é calculada aqui.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { k: "dim_qtd", l: "Qtd. volumes" },
                  { k: "dim_c", l: "Comprimento" },
                  { k: "dim_l", l: "Largura" },
                  { k: "dim_a", l: "Altura" },
                ].map((f) => (
                  <div key={f.k}>
                    <Label className="text-[10px]">{f.l}</Label>
                    <Input
                      className="h-9"
                      inputMode="decimal"
                      value={String(sim[f.k] ?? "")}
                      onChange={(e) => setSim((s) => ({ ...s, [f.k]: e.target.value.replace(",", ".") }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-3">
              {[
                { k: "reentrega", l: "Reentrega" },
                { k: "devolucao", l: "Devolução" },
                { k: "area_risco", l: "Área de risco" },
                { k: "dificuldade", l: "Difícil acesso" },
              ].map((f) => (
                <label key={f.k} className="flex items-center gap-1.5 text-xs">
                  <Switch checked={!!sim[f.k]} onCheckedChange={(v) => setSim((s) => ({ ...s, [f.k]: v }))} />
                  {f.l}
                </label>
              ))}
            </div>
            <Button size="sm" className="mt-3" onClick={onCalcular} disabled={!versaoId}>
              Calcular
            </Button>

            {resultado && (
              <div className="mt-4 rounded-lg ring-1 ring-border overflow-hidden">
                <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
                  Peso taxado {resultado.peso_taxado} kg · cubado {resultado.peso_cubado} kg · cubagem {resultado.cubagem} m³
                </div>
                <div className="divide-y divide-border">
                  {resultado.linhas.map((l: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span>{l.nome}</span>
                      <span className="tabular-nums">{brl(l.valor)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border space-y-0.5">
                  <div className="flex justify-between">
                    <span>Frete calculado</span>
                    <span className="tabular-nums">{brl(resultado.frete_calculado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frete mínimo da tabela</span>
                    <span className="tabular-nums">{resultado.frete_minimo === null ? "não configurado" : brl(resultado.frete_minimo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frete aplicado</span>
                    <span className="tabular-nums">{brl(resultado.frete_aplicado)}</span>
                  </div>
                  {resultado.minimo_motivo && <div className="text-amber-600">{resultado.minimo_motivo}</div>}
                </div>
                <div className="px-3 py-2 flex items-center justify-between text-sm font-medium bg-muted/30">
                  <span>Total</span>
                  <span className="tabular-nums">{brl(resultado.total)}</span>
                </div>
                {resultado.avisos?.length > 0 && (
                  <div className="px-3 py-2 text-[11px] text-amber-600">{resultado.avisos.join(" · ")}</div>
                )}
              </div>
            )}

          </div>

          {t?.tabela?.cliente_id ? (
            <PortalBox clienteId={t.tabela.cliente_id} empresaId={t.tabela.empresa_id} />
          ) : null}
        </div>
      </div>
    </PxSalesShell>
  );
}

function VigenciaBox({
  versaoId,
  versao,
  salvar,
  onSaved,
}: {
  versaoId: string;
  versao: any;
  salvar: any;
  onSaved: () => void;
}) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    setInicio(versao?.vigencia_inicio ?? "");
    setFim(versao?.vigencia_fim ?? "");
    setObs(versao?.observacoes ?? "");
  }, [versao]);

  if (!versao) return null;

  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 grid gap-3 sm:grid-cols-4 items-end">
      <div>
        <Label className="text-[11px]">Vigência início</Label>
        <Input type="date" className="h-9" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </div>
      <div>
        <Label className="text-[11px]">Vigência fim</Label>
        <Input type="date" className="h-9" value={fim ?? ""} onChange={(e) => setFim(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-[11px]">Observações da versão</Label>
        <Textarea rows={1} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await salvar({ data: { id: versaoId, vigencia_inicio: inicio, vigencia_fim: fim || null, observacoes: obs } });
            toast.success("Vigência atualizada.");
            onSaved();
          } catch (e: any) {
            toast.error(e?.message ?? "Não foi possível salvar.");
          }
        }}
      >
        Salvar vigência
      </Button>
    </div>
  );
}

function PortalBox({ clienteId, empresaId }: { clienteId: string; empresaId?: string | null }) {
  const fetchAcessos = useServerFn(listAcessosPortal);
  const salvar = useServerFn(salvarAcessoPortal);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["pxsales", "portal-acessos", clienteId],
    queryFn: () => fetchAcessos({ data: { cliente_id: clienteId } }),
  });
  const acesso = data?.[0];

  async function gerar() {
    try {
      const r = await salvar({
        data: {
          cliente_id: clienteId,
          empresa_id: empresaId ?? null,
          ver_tabela: true,
          ver_componentes: true,
          ver_valores: true,
          ver_cotacoes: true,
          ver_entregas: true,
          ver_comprovantes: true,
          baixar_comprovantes: true,
          solicitar_cotacao: true,
        },
      });
      const url = `${window.location.origin}/portal/cliente/${r.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link do portal gerado e copiado.");
      qc.invalidateQueries({ queryKey: ["pxsales", "portal-acessos", clienteId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o link.");
    }
  }

  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4">
      <div className="text-xs font-medium flex items-center gap-1.5 mb-2">
        <Share2 className="size-3.5" /> Portal do cliente
      </div>
      {acesso ? (
        <div className="text-[11px] text-muted-foreground break-all">
          Link ativo: {typeof window !== "undefined" ? window.location.origin : ""}/portal/cliente/{acesso.token}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Nenhum acesso criado para este cliente.</p>
      )}
      <Button size="sm" variant="secondary" className="mt-3" onClick={gerar}>
        {acesso ? "Atualizar permissões" : "Gerar link do portal"}
      </Button>
    </div>
  );
}
