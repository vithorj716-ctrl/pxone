import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PX_SYSTEMS } from "@/px-platform/systems";

export const Route = createFileRoute("/_authenticated/admin/perfis")({
  head: () => ({ meta: [{ title: "Administração — Perfis" }] }),
  component: AdminPerfis,
});

const ACOES = ["view", "create", "edit", "delete", "export", "approve"] as const;

function AdminPerfis() {
  const navigate = useNavigate();
  const [perfis, setPerfis] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, q] = await Promise.all([
        supabase.from("px_perfis").select("*").order("nome"),
        supabase.from("px_perfil_permissoes").select("*"),
      ]);
      setPerfis(p.data ?? []);
      setPerms(q.data ?? []);
      setLoading(false);
    })();
  }, []);

  function has(perfilId: string, sistema: string, acao: string) {
    return perms.some((p) => p.perfil_id === perfilId && p.sistema_key === sistema && p.acao === acao);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate({ to: "/admin" })} className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <div className="text-sm font-semibold">Perfis & Permissões</div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          perfis.map((perfil) => (
            <div key={perfil.id} className="rounded-xl ring-1 ring-border bg-surface/40 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="font-semibold">{perfil.nome}</div>
                  {perfil.descricao && <div className="text-xs text-muted-foreground">{perfil.descricao}</div>}
                </div>
                {perfil.is_system && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded ring-1 ring-border text-muted-foreground">padrão</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1.5 px-2">Sistema</th>
                      {ACOES.map((a) => <th key={a} className="px-2 py-1.5 text-center capitalize">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PX_SYSTEMS.map((s) => (
                      <tr key={s.key} className="border-t border-border">
                        <td className="py-1.5 px-2">{s.nome}</td>
                        {ACOES.map((a) => (
                          <td key={a} className="px-2 py-1.5 text-center">
                            <span className={has(perfil.id, s.key, a) ? "text-emerald-400" : "text-muted-foreground/30"}>●</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          A edição interativa de permissões será adicionada na próxima iteração. Atualmente o Diretor Geral já tem todas as permissões.
        </p>
      </main>
    </div>
  );
}
