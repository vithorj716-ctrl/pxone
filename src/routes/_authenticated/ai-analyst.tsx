import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { askAnalyst } from "@/lib/ai-analyst.functions";
import { toast } from "sonner";
import { Sparkles, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-analyst")({
  head: () => ({ meta: [{ title: "PXOne — AI Business Analyst" }] }),
  component: AiAnalystPage,
});

function AiAnalystPage() {
  const ask = useServerFn(askAnalyst);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    const q = question.trim();
    setLoading(true);
    try {
      const { answer } = await ask({ data: { question: q } });
      setHistory((h) => [{ q, a: answer }, ...h]);
      setQuestion("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao consultar o analista");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="AI Business Analyst" subtitle="Pergunte sobre os dados reais do sistema">
      <div className="bg-surface ring-1 ring-border rounded-xl p-6">
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ex: Qual a soma dos custos pendentes por empresa?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Analisando…" : (<><Send className="size-3.5" /> Perguntar</>)}
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-2">
          O analista usa apenas os dados cadastrados no sistema (empresas, custos, KPIs, valuations, riscos, decisões, payback, OKRs).
        </p>
      </div>

      <div className="space-y-3">
        {history.length === 0 && !loading && (
          <div className="bg-surface ring-1 ring-border rounded-xl p-10 text-center text-sm text-muted-foreground">
            Nenhuma pergunta feita ainda.
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className="bg-surface ring-1 ring-border rounded-xl p-5 space-y-3">
            <div className="text-xs text-muted-foreground">Pergunta</div>
            <div className="text-sm">{m.q}</div>
            <div className="h-px bg-border" />
            <div className="text-xs text-brand flex items-center gap-1"><Sparkles className="size-3" /> Resposta</div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.a}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
