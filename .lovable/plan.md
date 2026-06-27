# Evolução Arquitetural: PXOne → PX Platform

Esta atualização **adiciona** uma camada estrutural acima do que já existe. Nenhum módulo atual (Custos, Markup, Financial Intelligence, Dashboard, etc.) será alterado, removido ou refatorado. Tudo continua funcionando exatamente como hoje.

## Princípio diretor

A camada nova é **aditiva e não-invasiva**: ela envolve e referencia o que já existe, em vez de reescrever. Os módulos atuais continuam lendo/escrevendo nas mesmas tabelas; a camada PX Core apenas as expõe como "fonte única" através de uma API interna padronizada e de um registry.

## O que será adicionado

### 1. PX Core (camada lógica de dados compartilhados)
Novo diretório `src/px-core/` com adaptadores que apontam para as tabelas já existentes:
- `empresas.ts` → tabela `empresas`
- `custos.ts` → tabela `custos` + `categorias_custo`
- `kpis.ts` → `kpis` + `kpi_snapshots`
- `documents.ts`, `notifications.ts`, `audit.ts`, `files.ts`
- Stubs preparados (sem tabela ainda) para: `filiais`, `clientes`, `fornecedores`, `produtos`, `servicos`, `plano_contas`, `colaboradores`

Cada adaptador exporta funções tipadas (`list`, `getById`, etc.). Módulos futuros consomem **somente** via PX Core — nunca tocam tabela de outro módulo direto.

### 2. Module Registry
`src/px-core/registry.ts` — registro estático em código (não em banco) dos módulos instalados:

```text
PXOne ERP · Markup Engine · Financial Intelligence · Business Plan ·
SWOT · KPI Center · Executive Command
```

Cada entrada: `{ key, nome, icone, versao, status, rotas, permissoes, eventos[], apis[] }`. Módulos futuros (PXSales, PXTMS, PXFleet, PXRH, PXBI, PXDocs, PXAI) ficam declarados como `status: "planejado"` — apenas reservados, não implementados.

### 3. Event Bus interno
`src/px-core/events.ts` — barramento pub/sub em memória (client + server) com tipos:
`venda.criada`, `cliente.criado`, `fornecedor.atualizado`, `custo.lancado`, `despesa.aprovada`, `faturamento.realizado`, `frete.entregue`, `pagamento.recebido`, etc.

Nenhum módulo atual passa a emitir agora (não vamos tocar neles). O bus fica disponível para módulos futuros e para opt-in gradual.

Persistência leve: tabela nova `px_events` (id, tipo, payload jsonb, origem, created_at) só para auditoria/replay. RLS + GRANTs padrão.

### 4. API Layer interno
`src/px-core/api/` — server functions (`createServerFn`) padronizadas:
`coreEmpresas.list`, `coreCustos.summary`, `coreKpis.list`, `coreDashboard.snapshot`, etc.

São wrappers finos sobre os adaptadores do PX Core. Módulos novos importam só daqui. Módulos atuais continuam como estão.

### 5. PX AI Core
`src/px-core/ai/` — consolida o padrão de chamada ao Lovable AI Gateway num único helper (`callPxAI({ mode, context })`) que:
- Carrega contexto via PX Core (nunca consulta tabelas direto)
- Aplica seleção de modelo (flash-lite/flash) já existente
- Reaproveitado pelos arquivos atuais via re-export, sem alterar a assinatura pública deles

### 6. Dashboard Global (`/platform`)
Nova rota `src/routes/_authenticated/platform.tsx` — painel administrativo da plataforma mostrando:
- Módulos instalados (do Registry) com versão/status
- Integrações ativas
- Eventos processados (contagem de `px_events`)
- Saúde do sistema (ping a server fn)
- Uso de armazenamento (tamanho agregado de `documents`)
- Uso da IA (contador de chamadas — novo)
- Logs recentes

Adiciona item "PX Platform" no menu lateral (`app-shell.tsx`) — apenas um link novo, sem mexer nos existentes.

## Migração de banco

Apenas **uma** migração aditiva:

```sql
-- px_events: log de eventos do barramento
CREATE TABLE public.px_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  origem text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.px_events TO authenticated;
GRANT ALL ON public.px_events TO service_role;
ALTER TABLE public.px_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read events" ON public.px_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert events" ON public.px_events FOR INSERT TO authenticated WITH CHECK (true);

-- px_ai_usage: contador de chamadas da IA
CREATE TABLE public.px_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  modelo text NOT NULL,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.px_ai_usage TO authenticated;
GRANT ALL ON public.px_ai_usage TO service_role;
ALTER TABLE public.px_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ai usage" ON public.px_ai_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert ai usage" ON public.px_ai_usage FOR INSERT TO authenticated WITH CHECK (true);
```

Nenhuma tabela existente é tocada.

## Arquivos novos

```text
src/px-core/
  registry.ts
  events.ts
  types.ts
  api/
    empresas.functions.ts
    custos.functions.ts
    kpis.functions.ts
    dashboard.functions.ts
    events.functions.ts
    ai-usage.functions.ts
  adapters/
    empresas.ts
    custos.ts
    kpis.ts
    documents.ts
  ai/
    core.ts            ← wrapper único do gateway
src/routes/_authenticated/platform.tsx
supabase/migrations/<ts>_px_platform.sql
```

## Arquivos editados (mínimo)

- `src/components/app-shell.tsx` → adicionar 1 item de menu "PX Platform"
- `.lovable/plan.md` → atualizar resumo

Nada mais é editado. Custos, Markup, Financial Intelligence, Dashboard, KPIs etc. permanecem intactos.

## Garantias

- ✅ Zero alteração visual ou funcional nos módulos atuais
- ✅ Zero alteração nas tabelas existentes
- ✅ Toda a camada nova é opt-in (módulos futuros usam; atuais ignoram)
- ✅ Preparado para PXSales/PXTMS/PXFleet/PXRH/PXBI/PXDocs/PXAI sem reestruturação

Posso aplicar?
