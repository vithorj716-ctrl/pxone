import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "PX Platform — Acesso" }] }),
  component: LoginPage,
});

const INTERNAL_DOMAIN = "@px.local";

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const email = login.trim().toLowerCase() + INTERNAL_DOMAIN;
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      navigate({ to: "/launcher" });
    } catch (err: any) {
      setErro("Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl ring-1 ring-border bg-surface/60 p-8">
        <div className="text-center space-y-1">
          <div className="mx-auto size-10 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--gradient-brand)" }}>
            <span className="text-sm font-bold text-brand-foreground">PX</span>
          </div>
          <h1 className="text-lg font-semibold">PX Platform</h1>
          <p className="text-xs text-muted-foreground">Acesso restrito</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Usuário</label>
          <input
            autoFocus
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm outline-none focus:ring-brand"
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm outline-none focus:ring-brand"
            autoComplete="current-password"
          />
        </div>
        {erro && <div className="text-xs text-red-400">{erro}</div>}
        <button
          type="submit"
          disabled={loading || !login || !senha}
          className="w-full py-2 rounded-md text-sm font-medium text-brand-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
