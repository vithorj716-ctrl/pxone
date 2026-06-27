import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PX_SYSTEMS } from "@/px-platform/systems";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Administração — Usuários" }] }),
  component: AdminUsuarios,
});

type Linha = {
  user_id: string;
  login: string;
  nome: string;
  cargo: string | null;
  situacao: string;
  sistemas: string[];
};

function AdminUsuarios() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: metas } = await supabase
      .from("px_usuarios_meta")
      .select("user_id, login, nome, cargo, situacao")
      .order("login");
    const { data: sist } = await supabase.from("px_usuario_sistemas").select("user_id, sistema_key, ativo");
    const map = new Map<string, string[]>();
    (sist ?? []).forEach((r: any) => {
      if (!r.ativo) return;
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.sistema_key);
      map.set(r.user_id, arr);
    });
    setRows((metas ?? []).map((m: any) => ({ ...m, sistemas: map.get(m.user_id) ?? [] })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin" })} className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <div className="text-sm font-semibold">Usuários</div>
        </div>
        <button onClick={load} className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border inline-flex items-center gap-1.5">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-xl ring-1 ring-border bg-surface/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface/60">
              <tr>
                <th className="text-left px-4 py-2">Login</th>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Cargo</th>
                <th className="text-left px-4 py-2">Situação</th>
                <th className="text-left px-4 py-2">Sistemas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{r.login}</td>
                  <td className="px-4 py-2">{r.nome}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.cargo ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ring-1 ${r.situacao === "ativo" ? "ring-emerald-500/30 text-emerald-400" : "ring-border text-muted-foreground"}`}>
                      {r.situacao}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.sistemas.map((k) => {
                        const sys = PX_SYSTEMS.find((s) => s.key === k);
                        return <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40">{sys?.nome ?? k}</span>;
                      })}
                      {r.sistemas.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Criação completa de usuários (Auth + meta + sistemas) será habilitada pelo formulário em breve.
          Para criar usuários agora, use a área de administração de Auth da Lovable Cloud.
        </p>
      </main>
    </div>
  );
}
