import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Handshake, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPxSalesAccess } from "@/lib/pxsales.functions";
import { PXSALES_ACCENT } from "@/components/pxsales/pxsales-shell";

export const Route = createFileRoute("/sales/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PXSales — Acesso comercial | Grupo PX" },
      { name: "description", content: "Entrada do PXSales, o sistema comercial do Grupo PX." },
      { property: "og:title", content: "PXSales — Acesso comercial" },
      { property: "og:description", content: "CRM e gestão comercial das operações logísticas do Grupo PX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesLogin,
});

const INTERNAL_DOMAIN = "@px.local";

type Estado = "verificando" | "login" | "sem-acesso";

function SalesLogin() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function validarAcesso() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setEstado("login");
      return;
    }
    try {
      const access = await getPxSalesAccess();
      if (access.allowed) {
        navigate({ to: "/sales", replace: true });
        return;
      }
      setEstado("sem-acesso");
    } catch {
      setEstado("login");
    }
  }

  useEffect(() => {
    void validarAcesso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const email = login.trim().toLowerCase() + INTERNAL_DOMAIN;
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      setEstado("verificando");
      await validarAcesso();
    } catch {
      setErro("Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    setEstado("login");
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-[#0a0a0c] text-foreground">
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-border relative overflow-hidden">
        <div
          className="absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-25"
          style={{ background: PXSALES_ACCENT }}
        />
        <div className="relative flex items-center gap-2">
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: PXSALES_ACCENT }}>
            <Handshake className="size-4 text-white" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-semibold">PXSales</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Grupo PX</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold leading-snug">
            O comercial da operação logística, do primeiro contato à entrega.
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            Leads, cotações de frete, propostas, portal do cliente, acompanhamento de entregas e comissões — tudo sobre
            o mesmo cadastro e as mesmas operações do Grupo PX.
          </p>
        </div>
        <div className="relative text-[10px] uppercase tracking-widest text-muted-foreground">
          Acesso restrito · Grupo PX
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        {estado === "verificando" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Verificando acesso…
          </div>
        )}

        {estado === "sem-acesso" && (
          <div className="w-full max-w-sm rounded-2xl ring-1 ring-border bg-surface/50 p-8 text-center space-y-4">
            <div className="mx-auto size-10 rounded-lg flex items-center justify-center bg-amber-500/15">
              <ShieldAlert className="size-5 text-amber-400" />
            </div>
            <h1 className="text-base font-semibold">Acesso não liberado</h1>
            <p className="text-xs text-muted-foreground">
              Sua conta não tem acesso ao PXSales. Fale com o administrador para solicitar a liberação.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => navigate({ to: "/launcher" })} className="flex-1 py-2 rounded-md text-xs ring-1 ring-border text-muted-foreground hover:text-foreground">
                Meus sistemas
              </button>
              <button onClick={sair} className="flex-1 py-2 rounded-md text-xs ring-1 ring-border text-muted-foreground hover:text-foreground">
                Sair
              </button>
            </div>
          </div>
        )}

        {estado === "login" && (
          <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl ring-1 ring-border bg-surface/50 p-8">
            <div className="space-y-1">
              <div className="size-9 rounded-lg flex items-center justify-center mb-3 lg:hidden" style={{ background: PXSALES_ACCENT }}>
                <Handshake className="size-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold">Entrar no PXSales</h1>
              <p className="text-xs text-muted-foreground">Use seu usuário do Grupo PX.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Usuário</label>
              <input
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full bg-background ring-1 ring-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2"
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
                  className="w-full bg-background ring-1 ring-border rounded-md pl-3 pr-10 py-2 text-sm outline-none focus:ring-2"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {erro && <div className="text-xs text-red-400">{erro}</div>}

            <button
              type="submit"
              disabled={loading || !login || !senha}
              className="w-full py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
              style={{ background: PXSALES_ACCENT }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
