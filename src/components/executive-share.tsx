import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createPortal } from "react-dom";
import {
  Download, X, MessageCircle, FileText, FileSpreadsheet, Image as ImageIcon,
  LayoutDashboard, Presentation, Copy, Loader2, Sparkles, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { generateExecutiveSummary } from "@/lib/executive-share.functions";

// ────────────────────────────────────────────────────────────────────────────
// Module registry — describes how to fetch + aggregate data per module
// ────────────────────────────────────────────────────────────────────────────

type Row = Record<string, any>;
type ModuleData = {
  rows: Row[];
  columns: { key: string; label: string; format?: (v: any) => string }[];
  kpis: { label: string; value: string; tone?: "brand" | "warning" | "danger" | "muted" }[];
  aggregates: Record<string, any>; // small JSON sent to AI
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

interface ModuleConfig {
  key: string;
  title: string;
  fetch: () => Promise<ModuleData>;
}

const MODULES: Record<string, ModuleConfig> = {
  custos: {
    key: "custos",
    title: "Central de Custos",
    fetch: async () => {
      const [{ data: cs }, { data: emps }, { data: cats }] = await Promise.all([
        supabase.from("custos").select("*").order("data", { ascending: false }).limit(500),
        supabase.from("empresas").select("id,codigo,nome"),
        supabase.from("categorias_custo").select("id,nome"),
      ]);
      const rows = (cs ?? []).map((c: any) => ({
        data: c.data,
        nome: c.nome,
        empresa: emps?.find((e: any) => e.id === c.empresa_id)?.nome ?? "—",
        categoria: cats?.find((x: any) => x.id === c.categoria_id)?.nome ?? "—",
        centro_custo: c.centro_custo ?? "—",
        tipo: c.tipo_custo,
        valor: Number(c.valor || 0),
        status: c.status,
      }));
      const total = rows.reduce((s, r) => s + r.valor, 0);
      const aprovado = rows.filter((r) => r.status === "aprovado").reduce((s, r) => s + r.valor, 0);
      const pendente = rows.filter((r) => r.status === "pendente").reduce((s, r) => s + r.valor, 0);
      // por categoria
      const byCat: Record<string, number> = {};
      rows.forEach((r) => (byCat[r.categoria] = (byCat[r.categoria] || 0) + r.valor));
      const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topGastos = [...rows].sort((a, b) => b.valor - a.valor).slice(0, 5)
        .map((r) => ({ nome: r.nome, valor: r.valor, categoria: r.categoria }));
      return {
        rows,
        columns: [
          { key: "data", label: "Data", format: fmtDate },
          { key: "nome", label: "Descrição" },
          { key: "empresa", label: "Empresa" },
          { key: "categoria", label: "Categoria" },
          { key: "centro_custo", label: "Centro de Custo" },
          { key: "tipo", label: "Tipo" },
          { key: "valor", label: "Valor", format: (v) => fmtBRL(v) },
          { key: "status", label: "Status" },
        ],
        kpis: [
          { label: "Total Lançado", value: fmtBRL(total) },
          { label: "Aprovado", value: fmtBRL(aprovado), tone: "brand" },
          { label: "Pendente", value: fmtBRL(pendente), tone: "warning" },
          { label: "Lançamentos", value: fmtNum(rows.length), tone: "muted" },
        ],
        aggregates: {
          total_lancado: total,
          total_aprovado: aprovado,
          total_pendente: pendente,
          qtd_lancamentos: rows.length,
          top_categorias: topCats.map(([k, v]) => ({ categoria: k, valor: v, pct: total ? (v / total) * 100 : 0 })),
          top_gastos: topGastos,
        },
      };
    },
  },
  markup: {
    key: "markup",
    title: "Markup Engine",
    fetch: async () => {
      const { data } = await supabase.from("markup_calculations").select("*").order("created_at", { ascending: false }).limit(500);
      const rows = (data ?? []).map((r: any) => ({
        produto: r.produto ?? "—",
        categoria: r.categoria ?? "—",
        custo: Number(r.custo_total || 0),
        preco: Number(r.preco_sugerido || 0),
        markup: Number(r.markup_pct || 0),
        margem: Number(r.margem_pct || 0),
        lucro: Number(r.lucro_unitario || 0),
        data: r.created_at,
      }));
      const avgMarkup = rows.length ? rows.reduce((s, r) => s + r.markup, 0) / rows.length : 0;
      const avgMargem = rows.length ? rows.reduce((s, r) => s + r.margem, 0) / rows.length : 0;
      const receitaPotencial = rows.reduce((s, r) => s + r.preco, 0);
      const lucroTotal = rows.reduce((s, r) => s + r.lucro, 0);
      return {
        rows,
        columns: [
          { key: "produto", label: "Produto" },
          { key: "categoria", label: "Categoria" },
          { key: "custo", label: "Custo", format: fmtBRL },
          { key: "preco", label: "Preço", format: fmtBRL },
          { key: "markup", label: "Markup", format: fmtPct },
          { key: "margem", label: "Margem", format: fmtPct },
          { key: "lucro", label: "Lucro", format: fmtBRL },
          { key: "data", label: "Data", format: fmtDate },
        ],
        kpis: [
          { label: "Markup Médio", value: fmtPct(avgMarkup), tone: "brand" },
          { label: "Margem Média", value: fmtPct(avgMargem), tone: "brand" },
          { label: "Receita Potencial", value: fmtBRL(receitaPotencial) },
          { label: "Lucro Estimado", value: fmtBRL(lucroTotal), tone: "brand" },
        ],
        aggregates: {
          qtd_calculos: rows.length,
          markup_medio: avgMarkup, margem_media: avgMargem,
          receita_potencial: receitaPotencial, lucro_total: lucroTotal,
          top_lucrativos: [...rows].sort((a, b) => b.lucro - a.lucro).slice(0, 5),
          deficitarios: rows.filter((r) => r.lucro < 0).length,
        },
      };
    },
  },
  empresas: {
    key: "empresas",
    title: "Empresas",
    fetch: async () => {
      const { data } = await supabase.from("empresas").select("*").order("nome");
      const rows = (data ?? []).map((e: any) => ({
        codigo: e.codigo, nome: e.nome, cnpj: e.cnpj ?? "—",
        segmento: e.segmento ?? "—", status: e.status ?? "ativa",
      }));
      return {
        rows,
        columns: [
          { key: "codigo", label: "Código" }, { key: "nome", label: "Nome" },
          { key: "cnpj", label: "CNPJ" }, { key: "segmento", label: "Segmento" },
          { key: "status", label: "Status" },
        ],
        kpis: [{ label: "Empresas", value: fmtNum(rows.length), tone: "brand" }],
        aggregates: { total_empresas: rows.length, empresas: rows },
      };
    },
  },
  kpis: {
    key: "kpis",
    title: "KPI Center",
    fetch: async () => {
      const { data } = await supabase.from("kpis").select("*").limit(500);
      const rows = (data ?? []).map((k: any) => ({
        nome: k.nome, categoria: k.categoria ?? "—", unidade: k.unidade ?? "",
        meta: Number(k.meta || 0), atual: Number(k.valor_atual || 0),
        atingimento: k.meta ? (Number(k.valor_atual || 0) / Number(k.meta)) * 100 : 0,
      }));
      const avgAting = rows.length ? rows.reduce((s, r) => s + r.atingimento, 0) / rows.length : 0;
      return {
        rows,
        columns: [
          { key: "nome", label: "KPI" }, { key: "categoria", label: "Categoria" },
          { key: "meta", label: "Meta", format: fmtNum }, { key: "atual", label: "Atual", format: fmtNum },
          { key: "atingimento", label: "Atingimento", format: fmtPct },
        ],
        kpis: [
          { label: "KPIs ativos", value: fmtNum(rows.length) },
          { label: "Atingimento médio", value: fmtPct(avgAting), tone: avgAting >= 80 ? "brand" : "warning" },
        ],
        aggregates: { total_kpis: rows.length, atingimento_medio: avgAting, kpis: rows.slice(0, 30) },
      };
    },
  },
  valuation: {
    key: "valuation",
    title: "Valuation Engine",
    fetch: async () => {
      const { data } = await supabase.from("valuation_models").select("*").limit(200);
      const rows = (data ?? []).map((v: any) => ({
        nome: v.nome, metodo: v.metodo, valor: Number(v.valor_calculado || 0),
        ebitda: Number(v.ebitda || 0), multiplo: Number(v.multiplo || 0),
        data: v.created_at,
      }));
      const total = rows.reduce((s, r) => s + r.valor, 0);
      return {
        rows,
        columns: [
          { key: "nome", label: "Modelo" }, { key: "metodo", label: "Método" },
          { key: "valor", label: "Valor", format: fmtBRL }, { key: "ebitda", label: "EBITDA", format: fmtBRL },
          { key: "multiplo", label: "Múltiplo", format: (v) => `${Number(v).toFixed(1)}x` },
          { key: "data", label: "Data", format: fmtDate },
        ],
        kpis: [
          { label: "Modelos", value: fmtNum(rows.length) },
          { label: "Valor Total", value: fmtBRL(total), tone: "brand" },
        ],
        aggregates: { qtd: rows.length, valor_total: total, modelos: rows.slice(0, 10) },
      };
    },
  },
  payback: {
    key: "payback",
    title: "Payback Center",
    fetch: async () => {
      const { data } = await supabase.from("payback_projects").select("*").limit(300);
      const rows = (data ?? []).map((p: any) => ({
        nome: p.nome, investimento: Number(p.investimento_inicial || 0),
        retorno_mensal: Number(p.retorno_mensal || 0),
        payback_meses: Number(p.payback_meses || 0), status: p.status,
      }));
      const invest = rows.reduce((s, r) => s + r.investimento, 0);
      const retorno = rows.reduce((s, r) => s + r.retorno_mensal, 0);
      return {
        rows,
        columns: [
          { key: "nome", label: "Projeto" },
          { key: "investimento", label: "Investimento", format: fmtBRL },
          { key: "retorno_mensal", label: "Retorno/mês", format: fmtBRL },
          { key: "payback_meses", label: "Payback (meses)", format: (v) => `${v} m` },
          { key: "status", label: "Status" },
        ],
        kpis: [
          { label: "Projetos", value: fmtNum(rows.length) },
          { label: "Investimento total", value: fmtBRL(invest), tone: "warning" },
          { label: "Retorno mensal", value: fmtBRL(retorno), tone: "brand" },
        ],
        aggregates: { qtd: rows.length, investimento_total: invest, retorno_mensal_total: retorno, projetos: rows.slice(0, 10) },
      };
    },
  },
  risk: {
    key: "risk",
    title: "Risk Center",
    fetch: async () => {
      const { data } = await supabase.from("risks").select("*").limit(300);
      const rows = (data ?? []).map((r: any) => ({
        nome: r.nome, categoria: r.categoria ?? "—", probabilidade: r.probabilidade,
        impacto: r.impacto, severidade: r.severidade, status: r.status,
      }));
      const altos = rows.filter((r) => r.severidade === "alto" || r.severidade === "critico").length;
      return {
        rows,
        columns: [
          { key: "nome", label: "Risco" }, { key: "categoria", label: "Categoria" },
          { key: "probabilidade", label: "Probabilidade" }, { key: "impacto", label: "Impacto" },
          { key: "severidade", label: "Severidade" }, { key: "status", label: "Status" },
        ],
        kpis: [
          { label: "Riscos mapeados", value: fmtNum(rows.length) },
          { label: "Críticos/Altos", value: fmtNum(altos), tone: altos > 0 ? "danger" : "brand" },
        ],
        aggregates: { total: rows.length, criticos: altos, riscos: rows.slice(0, 20) },
      };
    },
  },
  okr: {
    key: "okr",
    title: "OKR Center",
    fetch: async () => {
      const [{ data: okrs }, { data: krs }] = await Promise.all([
        supabase.from("okrs").select("*").limit(200),
        supabase.from("key_results").select("*").limit(500),
      ]);
      const rows = (okrs ?? []).map((o: any) => ({
        objetivo: o.objetivo, ciclo: o.ciclo, status: o.status, progresso: Number(o.progresso || 0),
      }));
      const avgProg = rows.length ? rows.reduce((s, r) => s + r.progresso, 0) / rows.length : 0;
      return {
        rows,
        columns: [
          { key: "objetivo", label: "Objetivo" }, { key: "ciclo", label: "Ciclo" },
          { key: "progresso", label: "Progresso", format: fmtPct }, { key: "status", label: "Status" },
        ],
        kpis: [
          { label: "OKRs", value: fmtNum(rows.length) },
          { label: "Key Results", value: fmtNum(krs?.length ?? 0) },
          { label: "Progresso médio", value: fmtPct(avgProg), tone: avgProg >= 70 ? "brand" : "warning" },
        ],
        aggregates: { total_okrs: rows.length, total_krs: krs?.length ?? 0, progresso_medio: avgProg },
      };
    },
  },
  growth: {
    key: "growth", title: "Growth Center",
    fetch: async () => {
      const { data } = await supabase.from("growth_initiatives").select("*").limit(300);
      const rows = (data ?? []).map((g: any) => ({
        nome: g.nome, categoria: g.categoria ?? "—", impacto_estimado: Number(g.impacto_estimado || 0),
        status: g.status, prazo: g.prazo,
      }));
      const impacto = rows.reduce((s, r) => s + r.impacto_estimado, 0);
      return {
        rows,
        columns: [
          { key: "nome", label: "Iniciativa" }, { key: "categoria", label: "Categoria" },
          { key: "impacto_estimado", label: "Impacto", format: fmtBRL }, { key: "status", label: "Status" },
          { key: "prazo", label: "Prazo", format: fmtDate },
        ],
        kpis: [
          { label: "Iniciativas", value: fmtNum(rows.length) },
          { label: "Impacto estimado", value: fmtBRL(impacto), tone: "brand" },
        ],
        aggregates: { qtd: rows.length, impacto_total: impacto, iniciativas: rows.slice(0, 10) },
      };
    },
  },
  decisions: {
    key: "decisions", title: "Decision Center",
    fetch: async () => {
      const { data } = await supabase.from("decisions").select("*").order("data_decisao", { ascending: false }).limit(300);
      const rows = (data ?? []).map((d: any) => ({
        titulo: d.titulo, tipo: d.tipo, status: d.status, data: d.data_decisao,
      }));
      return {
        rows,
        columns: [
          { key: "titulo", label: "Decisão" }, { key: "tipo", label: "Tipo" },
          { key: "status", label: "Status" }, { key: "data", label: "Data", format: fmtDate },
        ],
        kpis: [{ label: "Decisões registradas", value: fmtNum(rows.length) }],
        aggregates: { total: rows.length, decisoes: rows.slice(0, 15) },
      };
    },
  },
  investor: {
    key: "investor", title: "Investor Room",
    fetch: async () => {
      const { data } = await supabase.from("investor_updates").select("*").order("created_at", { ascending: false }).limit(100);
      const rows = (data ?? []).map((i: any) => ({
        titulo: i.titulo, periodo: i.periodo, status: i.status, data: i.created_at,
      }));
      return {
        rows,
        columns: [
          { key: "titulo", label: "Update" }, { key: "periodo", label: "Período" },
          { key: "status", label: "Status" }, { key: "data", label: "Data", format: fmtDate },
        ],
        kpis: [{ label: "Updates", value: fmtNum(rows.length) }],
        aggregates: { total: rows.length, updates: rows.slice(0, 10) },
      };
    },
  },
  documents: {
    key: "documents", title: "Documentos",
    fetch: async () => {
      const { data } = await supabase.from("documents").select("id,titulo,tipo,empresa_id,created_at").limit(300);
      const rows = (data ?? []).map((d: any) => ({ titulo: d.titulo, tipo: d.tipo, data: d.created_at }));
      return {
        rows,
        columns: [
          { key: "titulo", label: "Documento" }, { key: "tipo", label: "Tipo" },
          { key: "data", label: "Criado em", format: fmtDate },
        ],
        kpis: [{ label: "Documentos", value: fmtNum(rows.length) }],
        aggregates: { total: rows.length },
      };
    },
  },
  timeline: {
    key: "timeline", title: "Timeline",
    fetch: async () => {
      const { data } = await supabase.from("timeline_events").select("*").order("data_evento", { ascending: false }).limit(300);
      const rows = (data ?? []).map((e: any) => ({
        titulo: e.titulo, tipo: e.tipo, data: e.data_evento, status: e.status,
      }));
      return {
        rows,
        columns: [
          { key: "data", label: "Data", format: fmtDate }, { key: "titulo", label: "Evento" },
          { key: "tipo", label: "Tipo" }, { key: "status", label: "Status" },
        ],
        kpis: [{ label: "Eventos", value: fmtNum(rows.length) }],
        aggregates: { total: rows.length, eventos: rows.slice(0, 20) },
      };
    },
  },
  "business-plan": {
    key: "business-plan", title: "Business Plan",
    fetch: async () => {
      const { data } = await supabase.from("business_plans").select("*").limit(50);
      const rows = (data ?? []).map((b: any) => ({
        nome: b.nome, ano: b.ano, status: b.status, meta_receita: Number(b.meta_receita || 0),
      }));
      const meta = rows.reduce((s, r) => s + r.meta_receita, 0);
      return {
        rows,
        columns: [
          { key: "nome", label: "Plano" }, { key: "ano", label: "Ano" },
          { key: "meta_receita", label: "Meta Receita", format: fmtBRL }, { key: "status", label: "Status" },
        ],
        kpis: [
          { label: "Planos", value: fmtNum(rows.length) },
          { label: "Meta total", value: fmtBRL(meta), tone: "brand" },
        ],
        aggregates: { qtd: rows.length, meta_total: meta, planos: rows },
      };
    },
  },
  dashboard: {
    key: "dashboard", title: "Executive Command",
    fetch: async () => {
      const [{ data: cs }, { data: emps }, { data: kps }] = await Promise.all([
        supabase.from("custos").select("valor,status,tipo_custo,empresa_id"),
        supabase.from("empresas").select("id,codigo,nome"),
        supabase.from("kpis").select("nome,valor_atual,meta"),
      ]);
      const totalCustos = (cs ?? []).reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
      const aprovados = (cs ?? []).filter((c: any) => c.status === "aprovado").reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
      const fixos = (cs ?? []).filter((c: any) => c.tipo_custo === "fixo").reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
      const variaveis = (cs ?? []).filter((c: any) => c.tipo_custo === "variavel").reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
      return {
        rows: [],
        columns: [],
        kpis: [
          { label: "Empresas", value: fmtNum(emps?.length ?? 0), tone: "brand" },
          { label: "Custo total", value: fmtBRL(totalCustos) },
          { label: "Aprovados", value: fmtBRL(aprovados), tone: "brand" },
          { label: "KPIs ativos", value: fmtNum(kps?.length ?? 0) },
        ],
        aggregates: {
          empresas: emps?.length ?? 0,
          custo_total: totalCustos, custos_aprovados: aprovados,
          custos_fixos: fixos, custos_variaveis: variaveis,
          qtd_kpis: kps?.length ?? 0,
        },
      };
    },
  },
};

function resolveModule(pathname: string): ModuleConfig | null {
  const p = pathname.replace(/\/$/, "");
  if (p === "" || p === "/") return MODULES.dashboard;
  const seg = p.split("/").filter(Boolean).pop()!;
  return MODULES[seg] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Export button + modal
// ────────────────────────────────────────────────────────────────────────────

export function ExportButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mod = useMemo(() => resolveModule(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  if (!mod) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-brand-foreground text-xs font-medium hover:opacity-90 transition-opacity"
        title="Exportar relatório executivo"
      >
        <Download className="size-3.5" /> Exportar
      </button>
      {open && <ExportModal module={mod} onClose={() => setOpen(false)} />}
    </>
  );
}

type Format =
  | "whatsapp" | "resumo-pdf" | "relatorio-pdf" | "apresentacao-pdf"
  | "infografico-png" | "dashboard-png" | "excel" | "csv";

const FORMATS: { id: Format; label: string; desc: string; icon: any }[] = [
  { id: "whatsapp", label: "WhatsApp", desc: "Texto otimizado para grupos", icon: MessageCircle },
  { id: "resumo-pdf", label: "Resumo Executivo (PDF)", desc: "1 página executiva", icon: FileText },
  { id: "relatorio-pdf", label: "Relatório Completo (PDF)", desc: "KPIs + tabela + IA", icon: FileDown },
  { id: "apresentacao-pdf", label: "Apresentação (PDF)", desc: "Estilo slides", icon: Presentation },
  { id: "infografico-png", label: "Infográfico (PNG)", desc: "Imagem visual", icon: ImageIcon },
  { id: "dashboard-png", label: "Dashboard (PNG)", desc: "Card visual", icon: LayoutDashboard },
  { id: "excel", label: "Excel (.xlsx)", desc: "Dados completos", icon: FileSpreadsheet },
  { id: "csv", label: "CSV", desc: "Dados brutos", icon: FileSpreadsheet },
];

function ExportModal({ module: mod, onClose }: { module: ModuleConfig; onClose: () => void }) {
  const [data, setData] = useState<ModuleData | null>(null);
  const [ai, setAi] = useState<{
    resumo: string; destaques: string[]; alertas: string[]; recomendacoes: string[];
  } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [busy, setBusy] = useState<Format | null>(null);
  const genSummary = useServerFn(generateExecutiveSummary);

  useEffect(() => {
    mod.fetch().then((d) => {
      setData(d);
      setLoadingData(false);
      genSummary({ data: { moduleKey: mod.key, moduleTitle: mod.title, payload: { kpis: d.kpis, aggregates: d.aggregates } } })
        .then((r) => setAi(r))
        .catch((e) => {
          console.error(e);
          setAi({ resumo: "Análise indisponível no momento.", destaques: [], alertas: [], recomendacoes: [] });
        })
        .finally(() => setLoadingAi(false));
    }).catch((e) => {
      toast.error("Falha ao carregar dados: " + e.message);
      setLoadingData(false);
      setLoadingAi(false);
    });
  }, [mod.key]);

  async function handleExport(fmt: Format) {
    if (!data || !ai) {
      toast.error("Aguarde o carregamento dos dados");
      return;
    }
    setBusy(fmt);
    try {
      switch (fmt) {
        case "whatsapp": await exportWhatsApp(mod, data, ai); break;
        case "resumo-pdf": await exportPDF(mod, data, ai, "resumo"); break;
        case "relatorio-pdf": await exportPDF(mod, data, ai, "completo"); break;
        case "apresentacao-pdf": await exportPDF(mod, data, ai, "slides"); break;
        case "infografico-png": await exportImage(mod, data, ai, "infografico"); break;
        case "dashboard-png": await exportImage(mod, data, ai, "dashboard"); break;
        case "excel": exportExcel(mod, data); break;
        case "csv": exportCSV(mod, data); break;
      }
      if (fmt !== "whatsapp") toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? String(e)));
    } finally {
      setBusy(null);
    }
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-surface ring-1 ring-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Centro de Exportação Executiva</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Módulo: <span className="text-foreground font-medium">{mod.title}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="px-6 py-4 border-b border-border bg-surface-2/30">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Sparkles className="size-3.5 text-brand" /> Análise IA
          </div>
          {loadingAi ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Gerando análise executiva…
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{ai?.resumo}</p>
          )}
          {ai && ai.alertas.length > 0 && (
            <div className="mt-3 space-y-1">
              {ai.alertas.slice(0, 2).map((a, i) => (
                <p key={i} className="text-[11px] text-warning">⚠ {a}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 thin-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const isBusy = busy === f.id;
              return (
                <button
                  key={f.id}
                  disabled={loadingData || busy !== null}
                  onClick={() => handleExport(f.id)}
                  className="text-left p-4 rounded-lg ring-1 ring-border bg-background hover:ring-brand hover:bg-surface-2/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3 group"
                >
                  <div className="size-9 rounded-md bg-brand/10 flex items-center justify-center text-brand shrink-0 group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                    {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Format renderers
// ────────────────────────────────────────────────────────────────────────────

function whatsappText(mod: ModuleConfig, data: ModuleData, ai: any) {
  const lines: string[] = [];
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push(`📊 *PXOne — ${mod.title}*`);
  lines.push(`🗓 ${new Date().toLocaleDateString("pt-BR")}`);
  lines.push("");
  if (data.kpis.length) {
    lines.push("*Indicadores*");
    data.kpis.forEach((k) => lines.push(`• ${k.label}: *${k.value}*`));
    lines.push("");
  }
  if (ai.resumo) { lines.push("*Resumo executivo*"); lines.push(ai.resumo); lines.push(""); }
  if (ai.destaques?.length) {
    lines.push("*Destaques*");
    ai.destaques.forEach((d: string) => lines.push(`✔ ${d}`));
    lines.push("");
  }
  if (ai.alertas?.length) {
    lines.push("*Alertas*");
    ai.alertas.forEach((a: string) => lines.push(`⚠ ${a}`));
    lines.push("");
  }
  if (ai.recomendacoes?.length) {
    lines.push("*Recomendações da IA*");
    ai.recomendacoes.forEach((r: string) => lines.push(`→ ${r}`));
    lines.push("");
  }
  lines.push("_Gerado automaticamente pelo PXOne_");
  lines.push("━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

async function exportWhatsApp(mod: ModuleConfig, data: ModuleData, ai: any) {
  const txt = whatsappText(mod, data, ai);
  try {
    await navigator.clipboard.writeText(txt);
    toast.success("Relatório WhatsApp copiado para a área de transferência");
  } catch {
    // fallback: open in a new window
    const w = window.open("", "_blank");
    if (w) { w.document.body.innerText = txt; }
    toast.message("Copie manualmente o texto exibido");
  }
}

function exportCSV(mod: ModuleConfig, data: ModuleData) {
  const headers = data.columns.map((c) => c.label);
  const lines = [headers.join(",")];
  data.rows.forEach((r) => {
    const row = data.columns.map((c) => {
      const v = r[c.key];
      const s = c.format ? c.format(v) : String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    });
    lines.push(row.join(","));
  });
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `pxone-${mod.key}-${stamp()}.csv`);
}

function exportExcel(mod: ModuleConfig, data: ModuleData) {
  const wb = XLSX.utils.book_new();
  // Sheet KPIs
  const kpiSheet = XLSX.utils.aoa_to_sheet([
    ["PXOne", mod.title], ["Gerado em", new Date().toLocaleString("pt-BR")], [],
    ["Indicador", "Valor"], ...data.kpis.map((k) => [k.label, k.value]),
  ]);
  XLSX.utils.book_append_sheet(wb, kpiSheet, "Indicadores");
  // Sheet dados
  if (data.rows.length) {
    const headers = data.columns.map((c) => c.label);
    const body = data.rows.map((r) => data.columns.map((c) => {
      const v = r[c.key];
      return c.format ? c.format(v) : v;
    }));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
    XLSX.utils.book_append_sheet(wb, sheet, "Dados");
  }
  XLSX.writeFile(wb, `pxone-${mod.key}-${stamp()}.xlsx`);
}

async function exportPDF(mod: ModuleConfig, data: ModuleData, ai: any, kind: "resumo" | "completo" | "slides") {
  const doc = new jsPDF({ orientation: kind === "slides" ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  const brand = [16, 122, 87] as const; // sla
  const fg = [20, 24, 28] as const;
  const muted = [110, 120, 130] as const;

  function header(title: string, sub?: string) {
    doc.setFillColor(brand[0], brand[1], brand[2]);
    doc.rect(0, 0, W, 6, "F");
    doc.setTextColor(fg[0], fg[1], fg[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, M, 50);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text(sub, M, 68);
    }
    doc.setDrawColor(230);
    doc.line(M, 82, W - M, 82);
  }

  function footer(pageLabel?: string) {
    doc.setFontSize(8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(`PXOne • Gerado em ${new Date().toLocaleString("pt-BR")}`, M, H - 20);
    if (pageLabel) doc.text(pageLabel, W - M, H - 20, { align: "right" });
  }

  function kpiGrid(yStart: number) {
    const cols = Math.min(4, data.kpis.length || 1);
    if (!data.kpis.length) return yStart;
    const cardW = (W - M * 2 - (cols - 1) * 12) / cols;
    const cardH = 60;
    data.kpis.slice(0, cols * 2).forEach((k, i) => {
      const x = M + (i % cols) * (cardW + 12);
      const y = yStart + Math.floor(i / cols) * (cardH + 12);
      doc.setFillColor(247, 248, 250);
      doc.roundedRect(x, y, cardW, cardH, 6, 6, "F");
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(k.label.toUpperCase(), x + 12, y + 18);
      doc.setTextColor(fg[0], fg[1], fg[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(k.value, x + 12, y + 42);
    });
    const rows = Math.ceil(Math.min(data.kpis.length, cols * 2) / cols);
    return yStart + rows * (cardH + 12);
  }

  function writeWrapped(text: string, x: number, y: number, maxW: number, lineH = 13, fontSize = 10): number {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    lines.forEach((ln: string, i: number) => doc.text(ln, x, y + i * lineH));
    return y + lines.length * lineH;
  }

  function section(title: string, items: string[], y: number, color: readonly [number, number, number] = fg) {
    if (!items.length) return y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title, M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(fg[0], fg[1], fg[2]);
    items.forEach((it) => {
      doc.setFontSize(9);
      doc.text("•", M, y);
      y = writeWrapped(it, M + 12, y, W - M * 2 - 12, 12, 9) + 4;
    });
    return y + 6;
  }

  if (kind === "slides") {
    // Slide 1 — capa
    doc.setFillColor(brand[0], brand[1], brand[2]);
    doc.rect(0, 0, W, H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(36);
    doc.text("PXOne", M, H / 2 - 40);
    doc.setFontSize(24);
    doc.text(mod.title, M, H / 2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    doc.text(`Apresentação Executiva • ${new Date().toLocaleDateString("pt-BR")}`, M, H / 2 + 30);

    // Slide 2 — KPIs
    doc.addPage();
    header("Indicadores Principais", mod.title);
    kpiGrid(110);
    footer("2");

    // Slide 3 — Resumo
    doc.addPage();
    header("Resumo Executivo", mod.title);
    writeWrapped(ai.resumo || "—", M, 110, W - M * 2, 16, 12);
    footer("3");

    // Slide 4 — Destaques + Alertas
    doc.addPage();
    header("Destaques & Alertas", mod.title);
    let y = 110;
    y = section("Destaques", ai.destaques || [], y);
    y = section("Alertas", ai.alertas || [], y, [200, 130, 0]);
    footer("4");

    // Slide 5 — Recomendações
    doc.addPage();
    header("Recomendações da IA", mod.title);
    section("Próximas ações priorizadas", ai.recomendacoes || [], 110, brand);
    footer("5");
  } else if (kind === "resumo") {
    header(mod.title, "Resumo Executivo • PXOne");
    let y = kpiGrid(100);
    y = writeWrapped(ai.resumo || "—", M, y + 10, W - M * 2, 14, 10) + 10;
    y = section("Destaques", (ai.destaques || []).slice(0, 4), y);
    y = section("Alertas", (ai.alertas || []).slice(0, 3), y, [200, 130, 0]);
    y = section("Recomendações", (ai.recomendacoes || []).slice(0, 4), y, brand);
    footer("1/1");
  } else {
    // completo
    header(mod.title, "Relatório Executivo Completo • PXOne");
    let y = kpiGrid(100);
    y = writeWrapped(ai.resumo || "—", M, y + 10, W - M * 2, 14, 10) + 10;
    y = section("Destaques", ai.destaques || [], y);
    y = section("Alertas", ai.alertas || [], y, [200, 130, 0]);
    y = section("Recomendações da IA", ai.recomendacoes || [], y, brand);

    // tabela de dados
    if (data.rows.length && data.columns.length) {
      doc.addPage();
      header("Dados detalhados", mod.title);
      const cols = data.columns.slice(0, 6);
      const colW = (W - M * 2) / cols.length;
      let ty = 100;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setFillColor(245, 246, 248);
      doc.rect(M, ty - 12, W - M * 2, 18, "F");
      cols.forEach((c, i) => doc.text(c.label, M + i * colW + 6, ty));
      ty += 12;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const max = Math.min(data.rows.length, 40);
      for (let i = 0; i < max; i++) {
        const r = data.rows[i];
        if (ty > H - 60) { doc.addPage(); header(mod.title, "Dados (continuação)"); ty = 100; }
        cols.forEach((c, j) => {
          const v = r[c.key];
          const txt = c.format ? c.format(v) : String(v ?? "");
          const t = txt.length > 28 ? txt.slice(0, 27) + "…" : txt;
          doc.text(t, M + j * colW + 6, ty);
        });
        ty += 14;
      }
      footer();
    }
  }
  doc.save(`pxone-${mod.key}-${kind}-${stamp()}.pdf`);
}

async function exportImage(mod: ModuleConfig, data: ModuleData, ai: any, kind: "infografico" | "dashboard") {
  // Render a hidden div, then html2canvas → PNG
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = kind === "infografico" ? "900px" : "1200px";
  host.style.background = "#0b0e14";
  host.style.color = "#e6e8eb";
  host.style.fontFamily = "Inter, system-ui, sans-serif";
  host.innerHTML = renderHtml(mod, data, ai, kind);
  document.body.appendChild(host);
  try {
    const canvas = await html2canvas(host, { backgroundColor: "#0b0e14", scale: 2 });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `pxone-${mod.key}-${kind}-${stamp()}.png`;
    a.click();
  } finally {
    document.body.removeChild(host);
  }
}

function renderHtml(mod: ModuleConfig, data: ModuleData, ai: any, kind: "infografico" | "dashboard") {
  const kpisHtml = data.kpis.map((k) => `
    <div style="background:#141923;border:1px solid #1f2630;border-radius:12px;padding:18px 20px;">
      <div style="font-size:11px;color:#7b8595;text-transform:uppercase;letter-spacing:.08em">${escape(k.label)}</div>
      <div style="font-size:26px;font-weight:600;margin-top:8px;color:${k.tone === "warning" ? "#e0a020" : k.tone === "danger" ? "#e05a5a" : k.tone === "brand" ? "#3ddc97" : "#fff"}">${escape(k.value)}</div>
    </div>`).join("");

  const list = (items: string[], color: string) => items.length
    ? `<ul style="list-style:none;padding:0;margin:8px 0 0 0">${items.map((i) =>
        `<li style="padding:6px 0;border-bottom:1px solid #1f2630;font-size:14px"><span style="color:${color};margin-right:8px">●</span>${escape(i)}</li>`).join("")}</ul>` : "";

  if (kind === "infografico") {
    return `
      <div style="padding:40px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div>
            <div style="font-size:11px;color:#7b8595;letter-spacing:.2em">PXONE • RELATÓRIO EXECUTIVO</div>
            <div style="font-size:30px;font-weight:600;margin-top:4px">${escape(mod.title)}</div>
          </div>
          <div style="font-size:12px;color:#7b8595">${new Date().toLocaleDateString("pt-BR")}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(data.kpis.length, 4) || 1},1fr);gap:14px;margin-bottom:24px">${kpisHtml}</div>
        <div style="background:#141923;border:1px solid #1f2630;border-radius:12px;padding:20px">
          <div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Análise IA</div>
          <p style="font-size:15px;line-height:1.6;margin:0">${escape(ai.resumo || "—")}</p>
          ${ai.destaques?.length ? `<div style="margin-top:14px"><div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.08em">Destaques</div>${list(ai.destaques.slice(0,4), "#3ddc97")}</div>` : ""}
          ${ai.alertas?.length ? `<div style="margin-top:14px"><div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.08em">Alertas</div>${list(ai.alertas.slice(0,3), "#e0a020")}</div>` : ""}
          ${ai.recomendacoes?.length ? `<div style="margin-top:14px"><div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.08em">Recomendações</div>${list(ai.recomendacoes.slice(0,4), "#5aa3ff")}</div>` : ""}
        </div>
        <div style="margin-top:24px;text-align:center;font-size:11px;color:#7b8595">Gerado automaticamente pelo PXOne</div>
      </div>`;
  }
  // dashboard
  return `
    <div style="padding:50px">
      <div style="font-size:11px;color:#7b8595;letter-spacing:.2em">DASHBOARD EXECUTIVO</div>
      <div style="font-size:42px;font-weight:700;margin:6px 0 30px">${escape(mod.title)}</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(data.kpis.length, 4) || 1},1fr);gap:18px;margin-bottom:30px">${kpisHtml}</div>
      <div style="background:#141923;border:1px solid #1f2630;border-radius:14px;padding:30px">
        <div style="font-size:13px;color:#7b8595;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Resumo IA</div>
        <p style="font-size:18px;line-height:1.6;margin:0">${escape(ai.resumo || "—")}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px">
        <div style="background:#141923;border:1px solid #1f2630;border-radius:14px;padding:24px">
          <div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.1em">Destaques</div>${list(ai.destaques || [], "#3ddc97")}
        </div>
        <div style="background:#141923;border:1px solid #1f2630;border-radius:14px;padding:24px">
          <div style="font-size:12px;color:#7b8595;text-transform:uppercase;letter-spacing:.1em">Recomendações</div>${list(ai.recomendacoes || [], "#5aa3ff")}
        </div>
      </div>
      <div style="margin-top:28px;text-align:right;font-size:11px;color:#7b8595">PXOne • ${new Date().toLocaleString("pt-BR")}</div>
    </div>`;
}

function escape(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
