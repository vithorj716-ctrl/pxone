import { PxGrupoLogo } from "@/components/px-logo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import * as Icons from "lucide-react";
import { useSystem } from "@/px-platform/system-context";
import { supabase } from "@/integrations/supabase/client";
import { Settings, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/launcher")({
  head: () => ({ meta: [{ title: "PX Platform — Selecionar Sistema" }] }),
  component: LauncherPage,
});

function LauncherPage() {
  const { loading, allowedSystems, setActiveSystem, touchLastAccess } = useSystem();
  const navigate = useNavigate();

  // Auto-enter se só houver 1 sistema
  useEffect(() => {
    if (loading) return;
    if (allowedSystems.length === 1) {
      const s = allowedSystems[0];
      setActiveSystem(s.key);
      void touchLastAccess(s.key);
      navigate({ to: s.rota as any });
    }
  }, [loading, allowedSystems, navigate, setActiveSystem, touchLastAccess]);

  async function logout() {
    setActiveSystem(null);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  function enter(key: string, rota: string) {
    setActiveSystem(key);
    void touchLastAccess(key);
    navigate({ to: rota as any });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PxGrupoLogo height={26} className="shrink-0" />
          <div>
            <div className="text-sm font-semibold leading-none">PX Platform</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selecionar Sistema</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface/60"
            title="Administração"
          >
            <Settings className="size-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface/60"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold">Bem-vindo</h1>
          <p className="text-sm text-muted-foreground mt-1">Escolha o sistema que deseja acessar.</p>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Carregando sistemas…</div>
        ) : allowedSystems.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            Você ainda não possui acesso a nenhum sistema. Procure o administrador.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allowedSystems.map((s) => {
              const Icon = (Icons as any)[s.icone] ?? Icons.AppWindow;
              return (
                <button
                  key={s.key}
                  onClick={() => enter(s.key, s.rota)}
                  className="text-left rounded-2xl ring-1 ring-border bg-surface/40 hover:bg-surface/70 transition p-5 group"
                >
                  <div
                    className="size-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: s.cor + "22", color: s.cor }}
                  >
                    <Icon className="size-6" />
                  </div>
                  <div className="font-semibold">{s.nome}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.descricao}</div>
                  <div className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">Entrar →</div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
