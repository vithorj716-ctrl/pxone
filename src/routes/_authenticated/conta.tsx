import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({ meta: [{ title: "Minha conta" }] }),
  component: ContaPage,
});

function ContaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function alterar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (senha.length < 6) { setMsg("Mínimo de 6 caracteres."); return; }
    if (senha !== conf) { setMsg("As senhas não coincidem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    setMsg("Senha alterada.");
    setSenha(""); setConf("");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate({ to: "/launcher" })} className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <div className="text-sm font-semibold">Minha conta</div>
      </header>
      <main className="max-w-md mx-auto px-4 py-10">
        <form onSubmit={alterar} className="space-y-4 rounded-xl ring-1 ring-border bg-surface/40 p-5">
          <h2 className="text-sm font-semibold">Alterar senha</h2>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nova senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Confirmar senha</label>
            <input type="password" value={conf} onChange={(e) => setConf(e.target.value)} className="w-full bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm" />
          </div>
          {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
          <button disabled={loading} className="w-full py-2 rounded-md text-sm text-brand-foreground" style={{ background: "var(--gradient-brand)" }}>
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </form>
      </main>
    </div>
  );
}
