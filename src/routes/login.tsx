import { PxGrupoLogo } from "@/components/px-logo";
import AeroShards from "@/components/effects/AeroShards";
import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PX Platform — Acesso" },
      { name: "description", content: "Acesso seguro à plataforma corporativa do Grupo PX." },
      { property: "og:title", content: "PX Platform — Acesso" },
      { property: "og:description", content: "Acesso seguro à plataforma corporativa do Grupo PX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const INTERNAL_DOMAIN = "@px.local";

function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0" aria-hidden="true">
        <AeroShards
          backgroundColor="#07131D"
          shardColor="#74D7FF"
          accentColor="#B9EEFF"
          placement="full"
          flow="stream"
          material="pearl"
          detail="balanced"
          effect="none"
          scale={1}
          spread={1}
          depth={1}
          speed={1}
          spin={1}
          interaction="repel"
          density={1.5}
          shardSize={1.1}
          stretch={1}
          turbulence={1}
          glow={1}
          edgeSoftness={2}
          bloom={0.5}
          grain={0.05}
          chromaticAberration={0.0075}
          transitionDuration={1}
          interactionRadius={1.5}
          interactionStrength={0.5}
          rippleIntensity={1}
          holdToGather
        />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-xl border border-foreground/10 bg-background/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-1">
          <PxGrupoLogo onDark height={38} className="mx-auto mb-2" />
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
          <div className="relative">
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-background ring-1 ring-border rounded-md pl-3 pr-10 py-2 text-sm outline-none focus:ring-brand"
              autoComplete="current-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>
        {erro && <div className="text-xs text-red-400">{erro}</div>}
        <Button
          type="submit"
          disabled={loading || !login || !senha}
          className="w-full text-brand-foreground"
          style={{ background: "var(--gradient-brand)" }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      </div>
    </div>
  );
}
