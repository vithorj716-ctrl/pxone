import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PX_MODULES } from "@/px-core/registry";
import { useEmpresaAtiva } from "@/px-core/empresa-context";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, CheckCircle2, Circle, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/aplicacoes")({
  head: () => ({ meta: [{ title: "PX Platform — Aplicações" }] }),
  component: AplicacoesPage,
});

type EmpresaModulo = { empresa_id: string; modulo_key: string; ativo: boolean };

function AplicacoesPage() {
  const { empresa, isGrupo } = useEmpresaAtiva();
  const [habilitados, setHabilitados] = useState<EmpresaModulo[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("px_empresa_modulos")
      .select("empresa_id, modulo_key, ativo");
    setHabilitados((data ?? []) as EmpresaModulo[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggle(moduloKey: string, ativar: boolean) {
    if (!empresa) {
      toast.error("Selecione uma empresa específica para gerenciar aplicações");
      return;
    }
    const existing = habilitados.find(
      (h) => h.empresa_id === empresa.id && h.modulo_key === moduloKey,
    );
    if (existing) {
      await supabase
        .from("px_empresa_modulos")
        .update({ ativo: ativar })
        .eq("empresa_id", empresa.id)
        .eq("modulo_key", moduloKey);
    } else {
      await supabase
        .from("px_empresa_modulos")
        .insert({ empresa_id: empresa.id, modulo_key: moduloKey, ativo: ativar });
    }
    toast.success(ativar ? "Aplicação habilitada" : "Aplicação desabilitada");
    void load();
  }

  function countEmpresas(key: string) {
    return habilitados.filter((h) => h.modulo_key === key && h.ativo).length;
  }
  function isAtivoParaEmpresa(key: string) {
    if (!empresa) return false;
    return habilitados.some((h) => h.empresa_id === empresa.id && h.modulo_key === key && h.ativo);
  }

  return (
    <AppShell
      title="Aplicações"
      subtitle={isGrupo ? "Visão do grupo — selecione uma empresa para habilitar/desabilitar" : `Aplicações de ${empresa?.nome_fantasia || empresa?.nome}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {PX_MODULES.map((m) => {
          const ativo = isAtivoParaEmpresa(m.key);
          const total = countEmpresas(m.key);
          const planejado = m.status !== "ativo";
          return (
            <div
              key={m.key}
              className="rounded-xl ring-1 ring-border bg-surface/60 p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                    <Package className="size-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{m.nome}</div>
                    <div className="text-[10px] text-muted-foreground">v{m.versao}</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${
                    m.status === "ativo"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : m.status === "beta"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.status}
                </span>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2">{m.descricao}</p>

              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Boxes className="size-3" /> {total} empresa{total === 1 ? "" : "s"}
                </span>
                {m.permissoes.length > 0 && (
                  <span className="truncate">{m.permissoes.slice(0, 2).join(", ")}</span>
                )}
              </div>

              {empresa && !planejado ? (
                <button
                  onClick={() => toggle(m.key, !ativo)}
                  disabled={loading}
                  className={`w-full text-xs py-1.5 rounded-md flex items-center justify-center gap-1.5 ring-1 transition-colors ${
                    ativo
                      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                      : "bg-surface text-muted-foreground ring-border hover:text-foreground"
                  }`}
                >
                  {ativo ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                  {ativo ? "Habilitada" : "Habilitar"}
                </button>
              ) : (
                <div className="text-[10px] text-center text-muted-foreground py-1.5">
                  {planejado ? "Em planejamento" : "Selecione uma empresa"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
