
# Integração definitiva do Ecossistema PX

Este projeto (PX One) já é o **Core/ERP** e já expõe a **PX API** (Fases 1–4 concluídas: `/api/public/v1/*`, JWT, idempotência, OpenAPI). Falta a camada de **integração federada** entre os três sistemas, **sem tocar em UI, menus, telas, regras ou banco**.

A proposta é puramente **infraestrutura de integração**: cliente HTTP outbound + contratos inbound + observabilidade. Nada visual muda.

## Princípio

- PX One **continua** dono de: financeiro, contas, fluxo de caixa, BI, admin, auditoria.
- PX Comercial passa a ser **Master Data** de: clientes, contatos, tabelas de frete, cotações, propostas, regras comerciais.
- PX Log passa a ser **Master Data** de: solicitações, embarques, viagens, entregas, tracking, ocorrências.
- Comunicação **só por API**. Nenhum acesso cruzado a banco.

## O que será criado (somente backend, zero UI)

### 1. SDK outbound `src/px-integration/` (novo, isolado)
Cliente HTTP tipado que o PX One usa para consumir CRM e TMS. **Não substitui** nada existente — fica disponível para quem quiser plugar depois.

```
src/px-integration/
├── client.ts          # fetch wrapper: baseURL, JWT (client_credentials), retry, timeout, circuit breaker
├── cache.ts           # cache em memória com TTL curto (60s default) para performance
├── errors.ts          # PxIntegrationError com código + mensagem amigável
├── crm.ts             # SDK PX Comercial: getClientes, getCliente, getTabelaFrete, getCotacao…
├── tms.ts             # SDK PX Log: getOperacoes, getFaturamentoOperacional…
└── config.ts          # lê PX_CRM_BASE_URL, PX_TMS_BASE_URL, PX_CRM_API_KEY, PX_TMS_API_KEY
```

### 2. Endpoints inbound novos no PX One (`/api/public/v1/`)
Apenas o que CRM/TMS vão precisar consumir do Core que ainda não existe:

- `POST /financeiro/lancamentos` — TMS publica faturamento operacional (idempotente por `operacao_id`).
- `GET  /financeiro/consolidado` — leitura agregada para dashboards externos.
- `GET  /dashboard/executivo` — leitura consolidada (financeiro + agregados puxados do CRM/TMS via SDK outbound, com fallback resiliente).

Todos seguem o mesmo padrão já estabelecido: JWT scoped, envelope `{status,data,...}`, paginação cursor, idempotência onde faz sentido.

### 3. Tabela de integração (uma única migration)
- `px_integration_links` — vínculo lógico entre entidades de domínios diferentes (ex.: `operacao_tms_id` ↔ `cotacao_crm_id` ↔ `cliente_crm_id`). Permite rastrear sem duplicar dados.
- `px_integration_inbox` — log de eventos recebidos (audit + replay).

Ambas com RLS, GRANTs e acesso só via `service_role` (consumido pela API).

### 4. Resiliência
- Timeout default 8s, 2 retries com backoff exponencial.
- Circuit breaker abre após 5 falhas seguidas, semi-aberto após 30s.
- Em falha: SDK lança `PxIntegrationError`; endpoints públicos retornam `503` com `Retry-After` e mensagem amigável; quem chama decide se degrada.
- Cache de leitura (clientes/tabelas de frete) com TTL 60s para reduzir round-trips e suportar indisponibilidade momentânea.

### 5. Segredos a configurar (uso futuro, opcional)
Quando CRM e TMS publicarem suas APIs, salvar via `add_secret`:
- `PX_CRM_BASE_URL`, `PX_CRM_CLIENT_ID`, `PX_CRM_CLIENT_SECRET`
- `PX_TMS_BASE_URL`, `PX_TMS_CLIENT_ID`, `PX_TMS_CLIENT_SECRET`

Enquanto não houver URL configurada, o SDK fica em **modo standby**: qualquer chamada retorna erro estruturado sem quebrar nada.

## O que NÃO muda

- Nenhuma rota visual, nenhum componente, nenhum menu, nenhum hook de UI.
- Nenhum schema de tabela existente.
- Nenhuma regra de negócio (cálculo de frete, markup, custos, KPIs).
- Telas de TMS continuam usando `tms_clientes` localmente até que o time do TMS migre para consumir o CRM via SDK — essa migração será feita lá, não aqui.

## Detalhes técnicos

- `createServerFn` apenas para handlers admin; integrações ficam em módulos puros chamados pelos endpoints `/api/public/v1/*` e por server functions futuras.
- Sem `supabaseAdmin` no topo de arquivos — sempre `await import` dentro do handler.
- OpenAPI atualizado com os 3 novos endpoints.
- Painel `/admin/px-api` ganha um card "Integrações" só-leitura mostrando status de CRM/TMS (online/offline/standby) — é um único componente novo já dentro de uma página existente, não conta como mudança de UX porque não altera nada do que já está lá; **se preferir, removo esse card**.

## Ordem de implementação

1. Migration `px_integration_links` + `px_integration_inbox`.
2. SDK `src/px-integration/*` (client + crm + tms + cache + errors + config).
3. 3 endpoints novos em `/api/public/v1/`.
4. OpenAPI atualizado.
5. (Opcional) Card de status no painel admin.

## Pergunta antes de executar

1. **CRM e TMS já têm API publicada** com URL/credenciais, ou devo deixar o SDK em standby aguardando? (Você mencionou que `PX_ONE_BASE_URL` ainda não foi salva no outro lado — provavelmente vamos ficar em standby dos dois lados por enquanto.)
2. **Posso adicionar o card "Integrações" só-leitura** no painel `/admin/px-api`, ou prefere zero alteração visual (mesmo informativa)?

Confirme essas duas e eu executo tudo em sequência.
