import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Workflow, Lock } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { getPxSalesAccess } from "@/lib/pxsales.functions";
import { listPipelineEtapas, listResponsaveis } from "@/lib/pxsales-pipeline.functions";
import { listComissaoRegras } from "@/lib/pxsales-comissoes.functions";

export const Route = createFileRoute("/_authenticated/sales/configuracoes")({
  head: () => ({
    meta: [
      { title: "PXSales — Configurações | Grupo PX" },
      { name: "description", content: "Etapas do funil, equipe comercial, regras de comissão e permissões do PXSales." },
      { property: "og:title", content: "PXSales — Configurações" },
      { property: "og:description", content: "Funil, equipe, comissões e permissões do PXSales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const fnAcesso = useServerFn(getPxSalesAccess);
  const fnEtapas = useServerFn(listPipelineEtapas);
  const fnEquipe = useServerFn(listResponsaveis);
  const fnRegras = useServerFn(listComissaoRegras);

  const { data: acesso } = useQuery({ queryKey: ["pxsales", "acesso"], queryFn: () => fnAcesso() });
  const { data: etapas = [] } = useQuery({ queryKey: ["pxsales", "etapas"], queryFn: () => fnEtapas() });
  const { data: equipe = [] } = useQuery({ queryKey: ["pxsales", "responsaveis"], queryFn: () => fnEquipe() });
  const { data: regras = [] } = useQuery({ queryKey: ["pxsales", "comissao-regras"], queryFn: () => fnRegras({ data: {} }) });

  const admin = !!acesso?.isAdmin;

  return (
    <PxSalesShell title="Configurações" subtitle="Funil, equipe e permissões">
      <div className="space-y-4">
        {!admin && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="size-4" /> Você pode consultar as configurações, mas apenas a administração altera esses dados.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-medium flex items-center gap-2"><Workflow className="size-4" /> Etapas do funil</h2>
            <ul className="mt-3 space-y-1.5">
              {(etapas as any[]).map((e) => (
                <li key={e.id ?? e.chave ?? e.nome} className="flex items-center gap-2 text-sm">
                  <span className="size-2 rounded-full" style={{ background: e.cor ?? "#94a3b8" }} />
                  <span className="truncate">{e.nome ?? e.label ?? e.chave}</span>
                </li>
              ))}
              {(etapas as any[]).length === 0 && <li className="text-sm text-muted-foreground">Usando as etapas padrão do funil.</li>}
            </ul>
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-medium flex items-center gap-2"><Users className="size-4" /> Equipe comercial</h2>
            <ul className="mt-3 space-y-1.5">
              {(equipe as any[]).map((u) => (
                <li key={u.id} className="text-sm truncate">{u.nome}</li>
              ))}
              {(equipe as any[]).length === 0 && <li className="text-sm text-muted-foreground">Nenhum usuário com acesso ao PXSales.</li>}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Liberação de acesso e nível de permissão são feitos em{" "}
              <Link to="/admin/usuarios" className="underline">Usuários</Link>.
            </p>
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-medium">Regras de comissão vigentes</h2>
            <ul className="mt-3 space-y-1.5">
              {regras.filter((r) => r.ativo).map((r) => (
                <li key={r.id} className="text-sm truncate">
                  {r.nome} — {r.tipo === "fixo" ? "valor fixo" : `${r.percentual}%`}
                </li>
              ))}
              {regras.filter((r) => r.ativo).length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhuma regra ativa. Cadastre em <Link to="/sales/comissoes" className="underline">Comissões</Link>.
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="size-4" /> Suas permissões</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(acesso?.permissoes ?? []).map((p) => (
                <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-xs">{p}</span>
              ))}
              {(acesso?.permissoes ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma permissão específica.</p>}
            </div>
          </section>
        </div>
      </div>
    </PxSalesShell>
  );
}
