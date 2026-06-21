import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { askAnalyst, getProactiveInsights } from "@/lib/ai-analyst.functions";
import { toast } from "sonner";
import { Sparkles, Send, X, Lightbulb, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-analyst")({
  head: () => ({ meta: [{ title: "PXOne — Conselheiro Executivo" }] }),
  component: AiAnalystPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Insight = { titulo: string; categoria: string; prioridade: "Alta" | "Média" | "Baixa" | string; mensagem: string };

const SUGESTOES = [
  "Faça um diagnóstico executivo do grupo agora.",
  "Quais são os 3 maiores riscos não mitigados?",
  "Onde estamos perdendo dinheiro? Custos críticos a revisar.",
  "Quais decisões estratégicas estão pendentes há mais tempo?",
  "Sugira ações para aumentar o valuation no próximo trimestre.",
];

function priColor(p: string) {
  if (p === "Alta") return "text-red-400 ring-red-500/30 bg-red-500/10";
  if (p === "Média") return "text-amber-400 ring-amber-500/30 bg-amber-500/10";
  return "text-emerald-400 ring-emerald-500/30 bg-emerald-500/10";
}

function AiAnalystPage() {
  const ask = useServerFn(askAnalyst);
  const insightsFn = useServerFn(getProactiveInsights);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const { insights } = await insightsFn({ data: {} } as any);
      setInsights(insights as Insight[]);
      setShowPopup(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar insights");
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    const userMsg: Msg = { role: "user", content: q.trim() };
    setHistory((h) => [...h, userMsg]);
    setQuestion("");
    try {
      const { answer } = await ask({
        data: { question: q.trim(), history: history.slice(-10) },
      });
      setHistory((h) => [...h, { role: "assistant", content: answer }]);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao consultar o conselheiro");
      setHistory((h) => [...h, { role: "assistant", content: `⚠️ ${err?.message ?? "Erro"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <AppShell
      title="Conselheiro Executivo PX"
      subtitle="CFO + Estrategista + Controller — acesso total ao banco de dados do grupo"
    >
      {/* Popup de insights proativos */}
      {showPopup && (
        <div className="relative bg-gradient-to-br from-brand/10 via-surface to-surface ring-1 ring-brand/30 rounded-xl p-5 shadow-lg">
          <button
            onClick={() => setShowPopup(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-brand" />
            <h3 className="text-sm font-semibold">Análise proativa do conselheiro</h3>
            <button
              onClick={loadInsights}
              disabled={insightsLoading}
              className="ml-auto mr-6 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3 ${insightsLoading ? "animate-spin" : ""}`} /> atualizar
            </button>
          </div>
          {insightsLoading && (
            <div className="text-xs text-muted-foreground">Analisando o banco de dados do grupo…</div>
          )}
          {!insightsLoading && insights && insights.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((it, i) => (
                <button
                  key={i}
                  onClick={() => send(`Aprofunde: ${it.titulo}`)}
                  className="text-left bg-background/60 hover:bg-background ring-1 ring-border rounded-lg p-3 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 ${priColor(it.prioridade)}`}>
                      {it.prioridade}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{it.categoria}</span>
                  </div>
                  <div className="text-xs font-medium mb-1 flex items-start gap-1">
                    {it.prioridade === "Alta" ? (
                      <AlertTriangle className="size-3 text-red-400 mt-0.5 shrink-0" />
                    ) : (
                      <TrendingUp className="size-3 text-brand mt-0.5 shrink-0" />
                    )}
                    {it.titulo}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">{it.mensagem}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input + sugestões */}
      <div className="bg-surface ring-1 ring-border rounded-xl p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(question);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder="Peça um conselho, análise ou diagnóstico…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Analisando…" : (<><Send className="size-3.5" /> Consultar</>)}
          </button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-[11px] px-2 py-1 rounded-full ring-1 ring-border bg-background hover:bg-surface text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Conversa */}
      <div className="space-y-3">
        {history.length === 0 && (
          <div className="bg-surface ring-1 ring-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            Sem conversas ainda. Use um atalho acima ou faça sua pergunta.
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 ring-1 ${
              m.role === "user" ? "bg-background ring-border" : "bg-surface ring-brand/20"
            }`}
          >
            <div className={`text-[11px] mb-2 flex items-center gap-1 ${m.role === "user" ? "text-muted-foreground" : "text-brand"}`}>
              {m.role === "user" ? "Você" : (<><Sparkles className="size-3" /> Conselheiro</>)}
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bg-surface ring-1 ring-brand/20 rounded-xl p-4 text-sm text-muted-foreground">
            Consultando o banco de dados do grupo e elaborando análise…
          </div>
        )}
      </div>
    </AppShell>
  );
}
