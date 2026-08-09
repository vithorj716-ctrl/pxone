import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPlatformUsers, setUserRoles, resetUserPassword, APP_ROLES } from "@/lib/px-users-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Administração — Usuários" }] }),
  component: AdminUsuarios,
});

const ROLE_LABEL: Record<string, string> = {
  master_admin: "Admin total",
  socio: "Sócio",
  diretor: "Diretor",
  gestor: "Gestor",
  consultor: "Consultor",
  auditor: "Auditor",
};

type Usuario = {
  id: string;
  email: string;
  login: string;
  nome: string | null;
  cargo: string | null;
  situacao: string | null;
  last_sign_in_at: string | null;
  roles: string[];
};

function AdminUsuarios() {
  const navigate = useNavigate();
  const fetchUsers = useServerFn(listPlatformUsers);
  const saveRoles = useServerFn(setUserRoles);
  const resetPwd = useServerFn(resetUserPassword);

  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pwdFor, setPwdFor] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchUsers();
      setRows(data as Usuario[]);
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggleRole(u: Usuario, role: string) {
    const next = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    setSaving(u.id);
    try {
      await saveRoles({ data: { userId: u.id, roles: next } });
      setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, roles: next } : r)));
      toast.success(`Acessos de ${u.login} atualizados.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar acessos.");
    } finally {
      setSaving(null);
    }
  }

  async function submitPassword(u: Usuario) {
    try {
      await resetPwd({ data: { userId: u.id, password: pwd } });
      toast.success(`Senha de ${u.login} alterada.`);
      setPwdFor(null);
      setPwd("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar senha.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin" })} className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <div className="text-sm font-semibold">Usuários & Níveis de Acesso</div>
        </div>
        <button onClick={load} className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border inline-flex items-center gap-1.5">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {erro && <div className="text-xs text-red-400 rounded-md ring-1 ring-red-500/30 p-3">{erro}</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
        ) : (
          rows.map((u) => (
            <div key={u.id} className="rounded-xl ring-1 ring-border bg-surface/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {u.login}
                    {u.roles.includes("master_admin") && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase px-1.5 py-0.5 rounded ring-1 ring-emerald-500/30 text-emerald-400">
                        <ShieldCheck className="size-3" /> Admin total
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.nome ?? "—"} · {u.email}</div>
                </div>
                <button
                  onClick={() => { setPwdFor(pwdFor === u.id ? null : u.id); setPwd(""); }}
                  className="text-xs px-2.5 py-1.5 rounded-md ring-1 ring-border inline-flex items-center gap-1.5"
                >
                  <KeyRound className="size-3.5" /> Senha
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {APP_ROLES.map((role) => {
                  const on = u.roles.includes(role);
                  return (
                    <button
                      key={role}
                      disabled={saving === u.id}
                      onClick={() => toggleRole(u, role)}
                      className={`text-xs px-2.5 py-1 rounded-full ring-1 transition disabled:opacity-50 ${
                        on ? "ring-brand text-brand bg-brand/10" : "ring-border text-muted-foreground hover:bg-surface/60"
                      }`}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  );
                })}
              </div>

              {pwdFor === u.id && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1 max-w-xs">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      placeholder="Nova senha (mín. 8)"
                      className="w-full bg-background ring-1 ring-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => submitPassword(u)}
                    disabled={pwd.length < 8}
                    className="text-xs px-3 py-2 rounded-md ring-1 ring-border disabled:opacity-50"
                  >
                    Salvar senha
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
