import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Ban, RefreshCw } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listLinksPortal, gerarLinkPortal, revogarLinkPortal, listPortalEventos } from "@/lib/pxsales-portal.functions";

export const Route = createFileRoute("/_authenticated/sales/portal")({
  head: () => ({
    meta: [
      { title: "PXSales — Portal do cliente | Grupo PX" },
      { name: "description", content: "Links seguros de proposta enviados aos clientes, com validade e registro de abertura." },
      { property: "og:title", content: "PXSales — Portal do cliente" },
      { property: "og:description", content: "Links seguros de proposta com validade e histórico de resposta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dh = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function PortalPage() {
  const qc = useQueryClient();
  const fnLinks = useServerFn(listLinksPortal);
  const fnGerar = useServerFn(gerarLinkPortal);
  const fnRevogar = useServerFn(revogarLinkPortal);
  const fnEventos = useServerFn(listPortalEventos);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({ queryKey: ["pxsales", "portal-links"], queryFn: () => fnLinks() });
  const { data: eventos = [] } = useQuery({
    queryKey: ["pxsales", "portal-eventos", detalhe],
    queryFn: () => fnEventos({ data: { proposta_id: detalhe ?? undefined } }),
    enabled: !!detalhe,
  });

  const url = (token: string) =>
    typeof window === "undefined" ? `/portal/proposta/${token}` : `${window.location.origin}/portal/proposta/${token}`;

  async function copiar(token: string) {
    await navigator.clipboard.writeText(url(token));
    toast.success("Link copiado.");
  }

  async function regerar(id: string) {
    try {
      await fnGerar({ data: { proposta_id: id, regerar: true, dias: 15 } });
      toast.success("Novo link gerado. O link anterior deixou de funcionar.");
      qc.invalidateQueries({ queryKey: ["pxsales", "portal-links"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar.");
    }
  }

  async function revogar(id: string) {
    try {
      await fnRevogar({ data: { proposta_id: id } });
      toast.success("Link desativado.");
      qc.invalidateQueries({ queryKey: ["pxsales", "portal-links"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desativar.");
    }
  }

  return (
    <PxSalesShell title="Portal do Cliente" subtitle="Links e acessos">
      <div className="space-y-4">
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Os links são gerados na tela da proposta e abrem uma página exclusiva do cliente, com valor, escopo, condições e
          os botões de aceitar, pedir alteração ou recusar. Página pública de acompanhamento de carga:{" "}
          <Link to="/rastreio" className="underline">/rastreio</Link>.
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando links…</p>
        ) : links.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Link2 className="size-6 mx-auto mb-2 opacity-60" />
            Nenhum link gerado ainda. Abra uma proposta e clique em “Gerar link do cliente”.
          </div>
        ) : (
          <div className="grid gap-2">
            {links.map((l: any) => (
              <div key={l.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to="/sales/propostas/$id" params={{ id: l.id }} className="font-medium hover:underline truncate block">
                      nº {l.numero} — {l.empresa_nome}
                    </Link>
                    <p className="text-sm text-muted-foreground truncate">
                      {brl(Number(l.valor_total))} · {l.portal_ativo ? "link ativo" : "link desativado"} · validade {dh(l.portal_expira_em)} ·
                      {l.portal_aberta_em ? ` aberto em ${dh(l.portal_aberta_em)}` : " ainda não aberto"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copiar(l.portal_token)}><Copy className="size-4 mr-1.5" /> Copiar</Button>
                    <a href={url(l.portal_token)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline"><ExternalLink className="size-4 mr-1.5" /> Abrir</Button>
                    </a>
                    <Button size="sm" variant="outline" onClick={() => regerar(l.id)}><RefreshCw className="size-4 mr-1.5" /> Regerar</Button>
                    <Button size="sm" variant="ghost" onClick={() => revogar(l.id)}><Ban className="size-4 mr-1.5" /> Desativar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetalhe(detalhe === l.id ? null : l.id)}>Histórico</Button>
                  </div>
                </div>

                {detalhe === l.id && (
                  <ul className="mt-3 border-t pt-3 space-y-1.5">
                    {eventos.length === 0 ? (
                      <li className="text-sm text-muted-foreground">Sem registros ainda.</li>
                    ) : (
                      eventos.map((ev) => (
                        <li key={ev.id} className="text-sm text-muted-foreground">
                          {dh(ev.created_at)} — {ev.tipo}
                          {ev.mensagem ? `: ${ev.mensagem}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PxSalesShell>
  );
}
