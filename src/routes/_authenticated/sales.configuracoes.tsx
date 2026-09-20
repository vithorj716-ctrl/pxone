import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { EmConstrucao } from "@/components/pxsales/em-construcao";
import { getPxSalesAccess } from "@/lib/pxsales.functions";
import { PXSALES_PERMISSIONS } from "@/pxsales/pxsales.permissions";

export const Route = createFileRoute("/_authenticated/sales/configuracoes")({
  head: () => ({
    meta: [
      { title: "PXSales — Configurações | Grupo PX" },
      { name: "description", content: "Administração comercial: etapas, origens, regras de comissão e permissões." },
      { property: "og:title", content: "PXSales — Configurações" },
      { property: "og:description", content: "Administração comercial do PXSales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesConfig,
});

function SalesConfig() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getPxSalesAccess);
  const { data: access, isLoading } = useQuery({
    queryKey: ["pxsales", "access"],
    queryFn: () => fetchAccess(),
    staleTime: 60_000,
  });

  return (
    <PxSalesShell title="Configurações" subtitle="Administração comercial">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !access?.isAdmin ? (
        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-6 max-w-md">
          <div className="size-9 rounded-lg flex items-center justify-center bg-amber-500/15 mb-3">
            <ShieldAlert className="size-4 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold">Área restrita</h2>
          <p className="text-xs text-muted-foreground mt-1.5">
            Você não tem permissão para alterar as configurações comerciais. Fale com o administrador.
          </p>
          <button
            onClick={() => navigate({ to: "/sales" })}
            className="mt-4 text-xs px-3 py-1.5 rounded-md ring-1 ring-border text-muted-foreground hover:text-foreground"
          >
            Voltar ao dashboard
          </button>
        </div>
      ) : (
        <>
          <EmConstrucao
            etapa="Etapa 8"
            titulo="Configurações do PXSales"
            descricao="Etapas do pipeline, origens de lead, segmentos, tipos de serviço, regras de comissão, tabelas comerciais, validade padrão das cotações, modelos de proposta, portal e status comerciais."
            itens={["Etapas do pipeline", "Origens e segmentos", "Regras de comissão", "Modelos de proposta", "Configurações do portal", "Validade padrão das cotações"]}
          />

          <div className="rounded-xl ring-1 ring-border bg-surface/30 p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Permissões do PXSales</div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Estas permissões são atribuídas pelos perfis já existentes da plataforma.
            </p>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
              {PXSALES_PERMISSIONS.map((p) => (
                <div key={p.acao} className="flex items-center justify-between gap-3 text-xs border-b border-border/50 py-1">
                  <span className="text-muted-foreground truncate">{p.label}</span>
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                      access.permissoes.includes(p.acao)
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {access.permissoes.includes(p.acao) ? "Liberado" : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </PxSalesShell>
  );
}
