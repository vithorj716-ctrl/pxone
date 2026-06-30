import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Shield, ArrowLeft, Boxes, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Administração da Plataforma" }] }),
  component: AdminHome,
});

function AdminHome() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setAllowed(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const ok = (data ?? []).some((r: any) => ["master_admin", "socio", "diretor"].includes(r.role));
      setAllowed(ok);
    })();
  }, []);

  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Verificando permissões…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-sm text-muted-foreground">Acesso restrito ao Diretor Geral.</div>
        <button onClick={() => navigate({ to: "/launcher" })} className="text-xs px-3 py-1.5 rounded-md ring-1 ring-border">Voltar ao Launcher</button>
      </div>
    );
  }

  const cards = [
    { to: "/admin/usuarios", label: "Usuários", desc: "Criar, editar e atribuir sistemas.", icon: Users },
    { to: "/admin/perfis", label: "Perfis & Permissões", desc: "Gerenciar perfis e permissões por sistema.", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/launcher" })} className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-brand" />
            <div>
              <div className="text-sm font-semibold leading-none">Administração da Plataforma</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">PX Platform</div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="rounded-2xl ring-1 ring-border bg-surface/40 hover:bg-surface/70 transition p-5 block"
            >
              <div className="size-10 rounded-lg bg-brand/15 text-brand flex items-center justify-center mb-3">
                <Icon className="size-5" />
              </div>
              <div className="font-semibold">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
