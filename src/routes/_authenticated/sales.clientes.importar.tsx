import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, CheckCircle2, Download, FileUp, Loader2, RefreshCw, Search,
  ShieldAlert, Sparkles, TriangleAlert, Users, XCircle,
} from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { formatCnpj } from "@/lib/cnpj";
import { parseClientesXml } from "@/pxsales/import/xml-parser";
import { normalizarArquivo } from "@/pxsales/import/normalize";
import { consolidar } from "@/pxsales/import/consolidate";
import type { MatchRegistro, RegistroNormalizado, ResultadoItem } from "@/pxsales/import/types";
import { lookupCnpj } from "@/lib/px-registry.functions";
import {
  analisarRegistrosImportacao, criarImportacao, finalizarImportacao, importarLoteClientes,
} from "@/lib/pxsales-import.functions";

export const Route = createFileRoute("/_authenticated/sales/clientes/importar")({
  head: () => ({
    meta: [
      { title: "Importar clientes por XML | PXSales" },
      { name: "description", content: "Importação em massa de clientes do PXSales a partir do histórico de visitas em XML." },
      { property: "og:title", content: "Importar clientes por XML — PXSales" },
      { property: "og:description", content: "Transforme o histórico de visitas comerciais em clientes completos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportarClientesPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

type Etapa = "arquivo" | "conferencia" | "importando" | "resultado";
type Filtro = "todos" | "novos" | "existentes" | "leads" | "revisao" | "duplicados";

const LOTE = 20;
const CONCORRENCIA_CNPJ = 3;

function nomeDe(r: RegistroNormalizado) {
  return r.razaoSocial?.valor ?? r.nomeFantasia?.valor ?? (r.cnpj ? formatCnpj(r.cnpj) : "Sem identificação");
}

function ImportarClientesPage() {
  const { empresa } = useEmpresaAtiva();
  const inputRef = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [arquivo, setArquivo] = useState<{ nome: string; hash: string; totalXml: number; mensagens: number } | null>(null);
  const [registros, setRegistros] = useState<RegistroNormalizado[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchRegistro>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [lendo, setLendo] = useState(false);
  const [enriquecendo, setEnriquecendo] = useState(false);
  const [progresso, setProgresso] = useState({ feito: 0, total: 0, rotulo: "" });
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [criarLeads, setCriarLeads] = useState(true);
  const cancelar = useRef(false);

  const fnAnalisar = useServerFn(analisarRegistrosImportacao);
  const fnCriar = useServerFn(criarImportacao);
  const fnLote = useServerFn(importarLoteClientes);
  const fnFinalizar = useServerFn(finalizarImportacao);
  const fnCnpj = useServerFn(lookupCnpj);

  const empresaId = empresa?.id ?? null;

  async function aoEscolherArquivo(file: File) {
    setLendo(true);
    try {
      const texto = await file.text();
      const parsed = parseClientesXml(texto, file.name);
      const normalizados = consolidar(normalizarArquivo(parsed.registros));
      setArquivo({ nome: file.name, hash: parsed.hash, totalXml: parsed.registros.length, mensagens: parsed.totalMensagens });
      setRegistros(normalizados);

      const resposta = await fnAnalisar({
        data: {
          empresa_id: empresaId,
          registros: normalizados.map((r) => ({
            xmlId: r.xmlId,
            registroHash: r.registroHash,
            cnpj: r.cnpj,
            telefones: r.telefones,
            emails: r.emails,
            nome: r.razaoSocial?.valor ?? null,
          })),
        },
      });
      const mapa: Record<string, MatchRegistro> = {};
      for (const m of resposta) mapa[m.xmlId] = m;
      setMatches(mapa);
      setSelecionados(new Set(normalizados.filter((r) => r.acaoSugerida !== "revisao" && !mapa[r.xmlId]?.jaImportado).map((r) => r.xmlId)));
      setEtapa("conferencia");
      toast.success(`${parsed.registros.length} registros lidos e consolidados em ${normalizados.length} empresas.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  async function enriquecerPorCnpj() {
    const alvo = registros.filter((r) => r.cnpj && selecionados.has(r.xmlId) && !r.situacaoCadastral);
    if (!alvo.length) return toast.info("Nada para consultar: os selecionados já estão enriquecidos ou não têm CNPJ.");
    setEnriquecendo(true);
    cancelar.current = false;
    setProgresso({ feito: 0, total: alvo.length, rotulo: "Consultando Receita Federal" });

    const atualizados = new Map<string, Partial<RegistroNormalizado>>();
    let feito = 0;
    let fila = 0;

    async function trabalhador() {
      while (fila < alvo.length && !cancelar.current) {
        const r = alvo[fila++]!;
        try {
          const d: any = await fnCnpj({ data: { cnpj: r.cnpj! } });
          atualizados.set(r.xmlId, {
            razaoSocial: d.razao_social ? { valor: d.razao_social, origem: "receita" } : r.razaoSocial,
            nomeFantasia: d.nome_fantasia ? { valor: d.nome_fantasia, origem: "receita" } : r.nomeFantasia,
            situacaoCadastral: d.situacao_cadastral ? { valor: d.situacao_cadastral, origem: "receita" } : null,
            endereco: {
              tipo: "comercial",
              apelido: "Endereço Receita Federal",
              cep: d.cep ?? r.endereco?.cep ?? null,
              logradouro: d.logradouro ?? r.endereco?.logradouro ?? null,
              numero: d.numero ?? r.endereco?.numero ?? null,
              complemento: d.complemento ?? r.endereco?.complemento ?? null,
              bairro: d.bairro ?? r.endereco?.bairro ?? null,
              cidade: d.cidade ?? r.endereco?.cidade ?? null,
              uf: d.uf ?? r.endereco?.uf ?? null,
              observacoes: null,
            },
            segmento: r.segmento ?? d.cnae_descricao ?? null,
          });
        } catch {
          /* registro segue com os dados do XML */
        }
        feito++;
        setProgresso({ feito, total: alvo.length, rotulo: "Consultando Receita Federal" });
        await new Promise((res) => setTimeout(res, 250));
      }
    }

    await Promise.all(Array.from({ length: CONCORRENCIA_CNPJ }, trabalhador));
    setRegistros((prev) => prev.map((r) => (atualizados.has(r.xmlId) ? { ...r, ...atualizados.get(r.xmlId)! } : r)));
    setEnriquecendo(false);
    toast.success(`${atualizados.size} empresa(s) enriquecida(s) com os dados oficiais.`);
  }

  async function importar() {
    if (!empresaId) return toast.error("Selecione a empresa ativa no topo da tela.");
    const lista = registros.filter((r) => selecionados.has(r.xmlId));
    if (!lista.length) return toast.error("Selecione ao menos um registro.");

    setEtapa("importando");
    cancelar.current = false;
    setProgresso({ feito: 0, total: lista.length, rotulo: "Importando" });

    try {
      const { importacaoId, reimportacao } = await fnCriar({
        data: {
          empresa_id: empresaId,
          arquivo_nome: arquivo?.nome ?? "clientes.xml",
          arquivo_hash: arquivo?.hash ?? "",
          total: lista.length,
          metadados: { registros_xml: arquivo?.totalXml, mensagens: arquivo?.mensagens },
        },
      });
      if (reimportacao) toast.info("Este arquivo já foi importado antes — registros repetidos serão ignorados.");

      const saida: ResultadoItem[] = [];
      for (let i = 0; i < lista.length; i += LOTE) {
        if (cancelar.current) break;
        const lote = lista.slice(i, i + LOTE);
        try {
          const r = await fnLote({
            data: { importacao_id: importacaoId, empresa_id: empresaId, registros: lote, sobrescrever, criarLeadSemCnpj: criarLeads },
          });
          saida.push(...r);
        } catch (e: any) {
          for (const item of lote) {
            saida.push({
              xmlId: item.xmlId, status: "erro", acao: "revisao", clienteId: null, leadId: null,
              mensagem: e?.message ?? "Falha no lote", empresa: nomeDe(item), cnpj: item.cnpj,
            });
          }
        }
        setProgresso({ feito: Math.min(i + LOTE, lista.length), total: lista.length, rotulo: "Importando" });
        setResultados([...saida]);
      }

      await fnFinalizar({ data: { importacao_id: importacaoId, empresa_id: empresaId, cancelada: cancelar.current } });
      setResultados(saida);
      setEtapa("resultado");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a importação.");
      setEtapa("conferencia");
    }
  }

  const estatisticas = useMemo(() => {
    let novos = 0, existentes = 0, leads = 0, revisao = 0, duplicados = 0, comCnpj = 0;
    for (const r of registros) {
      const m = matches[r.xmlId];
      if (m?.jaImportado) duplicados++;
      if (r.cnpj) comCnpj++;
      if (r.acaoSugerida === "revisao") revisao++;
      else if (!r.cnpj) leads++;
      else if (m?.clienteId) existentes++;
      else novos++;
    }
    return { novos, existentes, leads, revisao, duplicados, comCnpj, total: registros.length };
  }, [registros, matches]);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return registros.filter((r) => {
      const m = matches[r.xmlId];
      if (filtro === "novos" && !(r.cnpj && !m?.clienteId && r.acaoSugerida !== "revisao")) return false;
      if (filtro === "existentes" && !m?.clienteId) return false;
      if (filtro === "leads" && (r.cnpj || r.acaoSugerida === "revisao")) return false;
      if (filtro === "revisao" && r.acaoSugerida !== "revisao") return false;
      if (filtro === "duplicados" && !m?.jaImportado) return false;
      if (!b) return true;
      return (
        nomeDe(r).toLowerCase().includes(b) ||
        (r.cnpj ?? "").includes(b.replace(/\D/g, "")) ||
        r.telefones.some((t) => t.includes(b)) ||
        r.emails.some((e) => e.includes(b))
      );
    });
  }, [registros, matches, busca, filtro]);

  function alternar(id: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function baixarRelatorio() {
    const linhas = [
      ["empresa", "cnpj", "acao", "status", "mensagem", "cliente_id", "lead_id"].join(";"),
      ...resultados.map((r) =>
        [r.empresa ?? "", r.cnpj ?? "", r.acao, r.status, (r.mensagem ?? "").replace(/;/g, ","), r.clienteId ?? "", r.leadId ?? ""].join(";"),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${linhas}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `importacao-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PxSalesShell
      title="Importar clientes"
      subtitle="Histórico de visitas em XML"
      headerActions={
        <Button asChild size="sm" variant="ghost">
          <Link to="/sales/clientes"><ArrowLeft className="size-4 mr-1.5" /> Voltar</Link>
        </Button>
      }
    >
      {etapa === "arquivo" && (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl ring-1 ring-border bg-surface/30 p-8 text-center">
            <FileUp className="size-8 mx-auto text-muted-foreground" />
            <h2 className="text-base font-semibold mt-4">Envie o arquivo XML de visitas</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
              Lemos o arquivo aqui no seu navegador, juntamos as visitas da mesma empresa, buscamos os dados oficiais
              pelo CNPJ e mostramos tudo para você conferir antes de gravar. Nada é salvo sem a sua confirmação.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void aoEscolherArquivo(f);
                e.target.value = "";
              }}
            />
            <Button className="mt-5" disabled={lendo} onClick={() => inputRef.current?.click()}>
              {lendo ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <FileUp className="size-4 mr-1.5" />}
              {lendo ? "Lendo arquivo…" : "Escolher arquivo XML"}
            </Button>
            {!empresaId && (
              <p className="text-[11px] text-amber-400 mt-4 flex items-center justify-center gap-1.5">
                <ShieldAlert className="size-3.5" /> Selecione a empresa ativa no topo antes de importar.
              </p>
            )}
          </div>
        </div>
      )}

      {etapa === "conferencia" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
            {[
              { label: "Empresas no arquivo", valor: estatisticas.total },
              { label: "Novas", valor: estatisticas.novos },
              { label: "Já cadastradas", valor: estatisticas.existentes },
              { label: "Sem CNPJ (leads)", valor: estatisticas.leads },
              { label: "Para revisar", valor: estatisticas.revisao },
              { label: "Já importadas antes", valor: estatisticas.duplicados },
            ].map((k) => (
              <div key={k.label} className="rounded-xl ring-1 ring-border bg-surface/30 p-3.5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
                <div className="text-lg font-semibold mt-1">{k.valor}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, CNPJ, telefone ou e-mail" className="pl-8" />
            </div>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="todos">Todos</option>
              <option value="novos">Novas empresas</option>
              <option value="existentes">Já cadastradas</option>
              <option value="leads">Sem CNPJ</option>
              <option value="revisao">Para revisar</option>
              <option value="duplicados">Já importadas</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => setSelecionados(new Set(lista.map((r) => r.xmlId)))}>Selecionar filtrados</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
            <Button size="sm" variant="outline" disabled={enriquecendo} onClick={() => void enriquecerPorCnpj()}>
              {enriquecendo ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
              Buscar dados oficiais
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
              Sobrescrever dados já preenchidos na base
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={criarLeads} onChange={(e) => setCriarLeads(e.target.checked)} />
              Cadastrar empresas sem CNPJ como leads
            </label>
          </div>

          {enriquecendo && (
            <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> {progresso.rotulo}: {progresso.feito}/{progresso.total}
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((r) => {
              const m = matches[r.xmlId];
              const marcado = selecionados.has(r.xmlId);
              return (
                <button
                  key={r.xmlId}
                  onClick={() => alternar(r.xmlId)}
                  className={`text-left rounded-xl ring-1 p-4 transition ${marcado ? "ring-brand bg-brand/5" : "ring-border bg-surface/30 hover:ring-muted-foreground/40"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{nomeDe(r)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r.cnpj ? formatCnpj(r.cnpj) : "Sem CNPJ"}
                        {r.endereco?.cidade ? ` · ${r.endereco.cidade}${r.endereco.uf ? `/${r.endereco.uf}` : ""}` : ""}
                      </div>
                    </div>
                    <input type="checkbox" readOnly checked={marcado} className="mt-0.5" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    {m?.clienteId && <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">Já cadastrada ({m.motivo})</span>}
                    {!m?.clienteId && r.cnpj && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Nova empresa</span>}
                    {!r.cnpj && r.acaoSugerida === "lead" && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Lead</span>}
                    {r.acaoSugerida === "revisao" && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Revisar</span>}
                    {m?.jaImportado && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Importada antes</span>}
                    {r.situacaoCadastral && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.situacaoCadastral.valor}</span>}
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                    {[
                      { n: r.contatos.length, l: "Contatos" },
                      { n: r.telefones.length, l: "Telefones" },
                      { n: r.emails.length, l: "E-mails" },
                      { n: r.totalVisitas, l: "Visitas" },
                    ].map((x) => (
                      <div key={x.l}>
                        <div className="text-xs font-semibold">{x.n}</div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{x.l}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Completude {r.score}%</span>
                    {r.avisos.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-400" title={r.avisos.join("\n")}>
                        <TriangleAlert className="size-3" /> {r.avisos.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-4 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-t border-border flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {selecionados.size} de {registros.length} selecionados · arquivo {arquivo?.nome}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEtapa("arquivo"); setRegistros([]); }}>Trocar arquivo</Button>
              <Button size="sm" disabled={!selecionados.size || !empresaId} onClick={() => void importar()}>
                Importar {selecionados.size} empresa(s)
              </Button>
            </div>
          </div>
        </>
      )}

      {etapa === "importando" && (
        <div className="max-w-xl mx-auto rounded-2xl ring-1 ring-border bg-surface/30 p-8 text-center">
          <Loader2 className="size-7 mx-auto animate-spin text-muted-foreground" />
          <div className="text-sm font-medium mt-4">Importando clientes…</div>
          <div className="text-xs text-muted-foreground mt-1">{progresso.feito} de {progresso.total} processados</div>
          <div className="h-2 rounded-full bg-muted mt-4 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${progresso.total ? (progresso.feito / progresso.total) * 100 : 0}%` }} />
          </div>
          <Button size="sm" variant="ghost" className="mt-4" onClick={() => { cancelar.current = true; }}>
            Interromper (mantém o que já foi gravado)
          </Button>
        </div>
      )}

      {etapa === "resultado" && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Criadas", valor: resultados.filter((r) => r.acao === "criar" && r.status === "ok").length, icone: CheckCircle2 },
              { label: "Atualizadas", valor: resultados.filter((r) => r.acao === "atualizar" && r.status === "ok").length, icone: RefreshCw },
              { label: "Leads", valor: resultados.filter((r) => r.acao === "lead" && r.status === "ok").length, icone: Sparkles },
              { label: "Ignoradas", valor: resultados.filter((r) => r.status === "ignorado" || r.status === "revisao").length, icone: Users },
              { label: "Com erro", valor: resultados.filter((r) => r.status === "erro").length, icone: XCircle },
            ].map((k) => (
              <div key={k.label} className="rounded-xl ring-1 ring-border bg-surface/30 p-3.5">
                <k.icone className="size-4 text-muted-foreground" />
                <div className="text-lg font-semibold mt-2">{k.valor}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={baixarRelatorio}><Download className="size-4 mr-1.5" /> Baixar relatório</Button>
            <Button size="sm" asChild><Link to="/sales/clientes"><Building2 className="size-4 mr-1.5" /> Ver empresas</Link></Button>
            <Button size="sm" variant="ghost" onClick={() => { setEtapa("arquivo"); setRegistros([]); setResultados([]); }}>Nova importação</Button>
          </div>

          <div className="rounded-xl ring-1 ring-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr><th className="text-left p-2.5">Empresa</th><th className="text-left p-2.5">CNPJ</th><th className="text-left p-2.5">Resultado</th><th className="text-left p-2.5">Observação</th></tr>
              </thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.xmlId} className="border-t border-border">
                    <td className="p-2.5 truncate max-w-[220px]">{r.empresa ?? "—"}</td>
                    <td className="p-2.5 text-xs text-muted-foreground">{r.cnpj ? formatCnpj(r.cnpj) : "—"}</td>
                    <td className="p-2.5 text-xs">
                      {r.status === "erro" ? <span className="text-destructive">Erro</span> : r.acao === "criar" ? "Criada" : r.acao === "atualizar" ? "Atualizada" : r.acao === "lead" ? "Lead" : "Ignorada"}
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground">{r.mensagem ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PxSalesShell>
  );
}
