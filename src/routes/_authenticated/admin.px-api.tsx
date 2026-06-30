// Painel de administração da PX API — apenas executivos.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Plus, Power, RefreshCw, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  listApiClients,
  createApiClient,
  setApiClientAtivo,
  listApiLogs,
  PX_API_ESCOPOS,
} from "@/lib/px-api-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/px-api")({
  head: () => ({ meta: [{ title: "PX API • Administração" }] }),
  component: PxApiAdmin,
});

function PxApiAdmin() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setAllowed(false); return; }
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", userData.user.id);
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
        <div className="text-sm text-muted-foreground">Acesso restrito.</div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/launcher" })}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 sm:px-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-2 rounded-md hover:bg-surface/60 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-brand" />
            <div>
              <h1 className="text-sm font-semibold leading-none">PX API</h1>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                Núcleo de integração da PX Platform
              </div>
            </div>
          </div>
        </div>
        <Link
          to="/admin/px-api/docs"
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface/60"
        >
          Swagger UI ↗
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="clients">
          <TabsList>
            <TabsTrigger value="clients">Sistemas consumidores</TabsTrigger>
            <TabsTrigger value="logs">Logs de requisições</TabsTrigger>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
          </TabsList>
          <TabsContent value="clients" className="mt-4"><ApiClientsTab /></TabsContent>
          <TabsContent value="logs" className="mt-4"><ApiLogsTab /></TabsContent>
          <TabsContent value="docs" className="mt-4"><ApiDocsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ApiClientsTab() {
  const fnList = useServerFn(listApiClients);
  const fnSetAtivo = useServerFn(setApiClientAtivo);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["px-api", "clients"],
    queryFn: () => fnList(),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => fnSetAtivo({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["px-api", "clients"] });
      toast.success("Status atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Sistemas autorizados a consumir a PX API.
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5 mr-1" /> Novo sistema
        </Button>
      </div>

      <div className="rounded-lg ring-1 ring-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sistema</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Escopos</TableHead>
              <TableHead>Rate (rpm)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.sistema_key}</TableCell>
                <TableCell>{c.nome}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.api_key_prefix}…</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {(c.escopos ?? []).slice(0, 4).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                    {(c.escopos ?? []).length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{c.escopos.length - 4}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{c.rate_limit_rpm}</TableCell>
                <TableCell>
                  {c.ativo
                    ? <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">ativo</Badge>
                    : <Badge variant="secondary">inativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => toggle.mutate({ id: c.id, ativo: !c.ativo })}
                  >
                    <Power className="size-3.5 mr-1" />
                    {c.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {q.data && q.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum sistema cadastrado ainda. Crie o primeiro para liberar acesso à PX API.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateClientDialog
        open={open} onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["px-api", "clients"] })}
      />
    </div>
  );
}

function CreateClientDialog(props: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const fnCreate = useServerFn(createApiClient);
  const [form, setForm] = useState({
    sistema_key: "",
    nome: "",
    descricao: "",
    rate_limit_rpm: 120,
    escopos: ["clientes:read", "enderecos:read", "contatos:read", "financeiro:read"] as string[],
  });
  const [created, setCreated] = useState<{ api_key: string; secret: string } | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      fnCreate({
        data: {
          sistema_key: form.sistema_key,
          nome: form.nome,
          descricao: form.descricao,
          rate_limit_rpm: form.rate_limit_rpm,
          escopos: form.escopos,
        },
      }),
    onSuccess: (resp: any) => {
      setCreated({ api_key: resp.api_key, secret: resp.secret });
      props.onCreated();
      toast.success("Sistema criado. Guarde as credenciais agora.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar."),
  });

  function toggleEscopo(s: string) {
    setForm((f) => ({
      ...f,
      escopos: f.escopos.includes(s) ? f.escopos.filter((x) => x !== s) : [...f.escopos, s],
    }));
  }

  function reset() {
    setCreated(null);
    setForm({ sistema_key: "", nome: "", descricao: "", rate_limit_rpm: 120, escopos: [] });
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { props.onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{created ? "Credenciais geradas" : "Novo sistema consumidor"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Copie agora — o secret não aparece novamente."
              : "Cadastre um sistema que poderá consumir a PX API."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">api_key</Label>
              <Input readOnly value={created.api_key} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            </div>
            <div>
              <Label className="text-xs">secret</Label>
              <Input readOnly value={created.secret} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            </div>
            <div className="text-xs text-amber-500 flex items-start gap-2">
              <ShieldCheck className="size-3.5 mt-0.5" />
              Estas credenciais não poderão ser recuperadas. Em caso de perda, gere um novo sistema.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">sistema_key</Label>
                <Input
                  placeholder="ex: pxcomercial"
                  value={form.sistema_key}
                  onChange={(e) => setForm({ ...form, sistema_key: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  placeholder="PX Comercial"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={2}
                placeholder="CRM da plataforma"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Rate-limit (requisições/minuto)</Label>
              <Input
                type="number" min={1} max={10000}
                value={form.rate_limit_rpm}
                onChange={(e) => setForm({ ...form, rate_limit_rpm: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Escopos</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-md ring-1 ring-border p-2">
                {PX_API_ESCOPOS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={form.escopos.includes(s)}
                      onCheckedChange={() => toggleEscopo(s)}
                    />
                    <span className="font-mono">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={() => { props.onOpenChange(false); reset(); }}>Concluir</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => props.onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={mut.isPending || !form.sistema_key || !form.nome}
                onClick={() => mut.mutate()}
              >
                {mut.isPending ? "Criando…" : "Criar sistema"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiLogsTab() {
  const fnLogs = useServerFn(listApiLogs);
  const q = useQuery({
    queryKey: ["px-api", "logs"],
    queryFn: () => fnLogs({ data: { limit: 200 } }),
    refetchInterval: 15_000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">Últimas 200 requisições.</div>
        <Button size="sm" variant="ghost" onClick={() => q.refetch()}>
          <RefreshCw className="size-3.5 mr-1" /> Atualizar
        </Button>
      </div>
      <div className="rounded-lg ring-1 ring-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Sistema</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Latência</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="font-mono text-xs">{l.sistema_key ?? "—"}</TableCell>
                <TableCell className="text-xs">{l.metodo}</TableCell>
                <TableCell className="font-mono text-xs">{l.endpoint}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="secondary"
                    className={
                      l.status >= 500 ? "bg-red-500/15 text-red-500" :
                      l.status >= 400 ? "bg-amber-500/15 text-amber-600" :
                      "bg-emerald-500/15 text-emerald-600"
                    }
                  >
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs">{l.latencia_ms ?? "—"} ms</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                  {l.erro_codigo ? `${l.erro_codigo}: ${l.erro_mensagem ?? ""}` : ""}
                </TableCell>
              </TableRow>
            ))}
            {q.data && q.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma requisição registrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ApiDocsTab() {
  const base = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);
  const example = `curl -s -X POST ${base}/api/public/v1/auth/token \\
  -H "content-type: application/json" \\
  -d '{"api_key":"pxa_...","secret":"pxs_..."}'`;
  const example2 = `curl -s ${base}/api/public/v1/clientes?page=1&pageSize=25 \\
  -H "authorization: Bearer <access_token>"`;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        A PX API é o ponto único de acesso aos dados centralizados do PXOne. Toda integração
        deve autenticar via <code>POST /api/public/v1/auth/token</code> e enviar o JWT
        recebido no header <code>Authorization: Bearer</code>.
      </p>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">1) Obter token</div>
        <pre className="text-xs rounded-md bg-muted/40 ring-1 ring-border p-3 overflow-x-auto">{example}</pre>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">2) Consumir endpoint</div>
        <pre className="text-xs rounded-md bg-muted/40 ring-1 ring-border p-3 overflow-x-auto">{example2}</pre>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Endpoints disponíveis</div>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li><code>GET /api/public/v1/health</code> — status público.</li>
          <li><code>POST /api/public/v1/auth/token</code> — emissão de token.</li>
          <li><code>POST /api/public/v1/auth/refresh</code> — renovação.</li>
          <li><code>GET /api/public/v1/clientes</code> — lista paginada (escopo <code>clientes:read</code>).</li>
          <li><code>GET /api/public/v1/clientes/:id</code> — detalhe (com <code>?include=enderecos,contatos</code>).</li>
          <li><code>GET /api/public/v1/clientes/:id/conta-corrente</code> — saldo, limite, vencidos (escopo <code>financeiro:read</code>).</li>
          <li><code>GET /api/public/v1/clientes/:id/enderecos</code> — endereços do cliente (escopo <code>clientes:read</code>).</li>
          <li><code>GET /api/public/v1/clientes/:id/contatos</code> — contatos do cliente (escopo <code>clientes:read</code>).</li>
          <li><code>GET /api/public/v1/clientes/:id/lancamentos</code> — lançamentos da conta corrente, paginado (escopo <code>clientes:read</code>).</li>
          <li><code>GET /api/public/v1/empresas</code> — lista de empresas do grupo (escopo <code>empresas:read</code>).</li>
          <li><code>GET /api/public/v1/empresas/:id</code> — detalhe (com <code>?include=filiais,modulos</code>).</li>
          <li><code>GET /api/public/v1/filiais</code> — lista de filiais (escopo <code>empresas:read</code>).</li>
          <li><code>GET /api/public/v1/perfis</code> — perfis e permissões (escopo <code>perfis:read</code>, <code>?include=permissoes</code>).</li>
          <li><code>GET /api/public/v1/usuarios</code> — lista de usuários (escopo <code>usuarios:read</code>).</li>
          <li><code>GET /api/public/v1/usuarios/:id</code> — detalhe (com <code>?include=perfis,sistemas</code>).</li>
          <li><code>GET /api/public/v1/tabelas-frete</code> — tabelas de frete cadastradas (escopo <code>tabela-frete:read</code>).</li>
          <li className="pt-1 font-semibold">Escrita (Fase 3)</li>
          <li><code>POST /api/public/v1/clientes</code> — cria cliente (<code>clientes:write</code>, idempotente por CNPJ + <code>Idempotency-Key</code>).</li>
          <li><code>PATCH /api/public/v1/clientes/:id</code> — atualização parcial (<code>clientes:write</code>).</li>
          <li><code>POST /api/public/v1/clientes/:id/inativar</code> — inativa cliente com motivo (<code>clientes:write</code>).</li>
          <li><code>POST /api/public/v1/clientes/:id/reativar</code> — reativa cliente (<code>clientes:write</code>).</li>
          <li><code>POST /api/public/v1/clientes/:id/enderecos</code> — cria endereço (<code>enderecos:write</code>).</li>
          <li><code>PATCH/DELETE /api/public/v1/clientes/:id/enderecos/:enderecoId</code> — atualiza/inativa endereço (<code>enderecos:write</code>).</li>
          <li><code>POST /api/public/v1/clientes/:id/contatos</code> — cria contato (<code>contatos:write</code>).</li>
          <li><code>PATCH/DELETE /api/public/v1/clientes/:id/contatos/:contatoId</code> — atualiza/remove contato (<code>contatos:write</code>).</li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Toda resposta segue o envelope padrão <code>{`{ status, message, data, timestamp, requestId }`}</code>.
      </p>
    </div>
  );
}
