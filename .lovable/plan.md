# PX API — Núcleo de Integração da PX Platform

Transformar o PXOne no **core de dados** da plataforma. Todos os demais sistemas (PXLog, PXComercial, PXMed, PXFarma, apps, portais) passam a consumir dados exclusivamente via **PX API** — nunca acessam o banco diretamente.

A entrega é grande. Proponho dividir em **4 fases**, todas baseadas no que já existe no PXOne (px_registry_*, px_cliente_*, tms_*, perfis, etc). Nada de reescrever cadastros — apenas expor de forma padronizada, segura, versionada e auditada.

---

## Fase 1 — Fundação da API (núcleo)

Criar a infraestrutura comum que todos os módulos vão herdar.

### 1.1 Rotas públicas versionadas
Endpoints externos em `src/routes/api/public/v1/*` (o prefixo `/api/public/*` bypassa auth do Lovable para podermos aplicar a nossa).

```
/api/public/v1/auth/token        POST  — emitir token
/api/public/v1/auth/refresh      POST  — renovar token
/api/public/v1/health            GET
```

Endpoints internos (consumidos pelo próprio PXOne, com sessão Supabase) continuam como `createServerFn`.

### 1.2 Autenticação própria da API (API Keys + Tokens)
Tabelas novas:
- `px_api_clients` — sistemas consumidores (PXLog, PXComercial, etc): `id, sistema_key, nome, api_key_hash, secret_hash, ativo, escopos[], rate_limit_rpm, criado_por, …`
- `px_api_tokens` — tokens emitidos (JWT assinado com segredo do servidor): `id, api_client_id, jti, expires_at, revogado, escopos[]`
- `px_api_logs` — log de toda requisição: `sistema_key, user_id?, endpoint, método, status, latência_ms, ip, request_id, ts, erro?`

Fluxo: sistema externo faz `POST /auth/token` com `api_key` + `secret` → recebe JWT (curto, 15min) + refresh token. Cada request envia `Authorization: Bearer <jwt>` + header `X-Request-Id`.

### 1.3 Middleware PX API
Um middleware único (`requirePxApiAuth`) que:
1. Valida JWT (assinatura, expiração, jti não revogado).
2. Carrega `api_client` e seus escopos.
3. Aplica rate-limit por `sistema_key` (contagem em memória + tabela).
4. Registra log da requisição (status, latência, ip).
5. Injeta `{ apiClient, scopes, requestId }` no contexto da rota.

### 1.4 Envelope de resposta padronizado
Helpers `pxOk(data)` / `pxErr(code, message, status)` que retornam SEMPRE:

```json
{
  "status": "ok" | "error",
  "message": "string",
  "data": { ... } | null,
  "timestamp": "2026-06-30T12:00:00Z",
  "requestId": "uuid"
}
```

Validação de entrada com **Zod** em 100% dos endpoints; erros viram `pxErr("VALIDATION_ERROR", …, 400)`.

### 1.5 Segredo de assinatura
Gerar `PX_API_JWT_SECRET` via `generate_secret` (64 chars).

---

## Fase 2 — Módulos de leitura (read-only para outros sistemas)

Expor o que já está cadastrado no PXOne, sem duplicar nada. Cada módulo vira um arquivo de rota em `src/routes/api/public/v1/<dominio>.ts` + handlers GET com paginação (`?page=&pageSize=`, máx 100), filtros, e projeção de colunas seguras.

| Módulo | Endpoints | Origem |
|---|---|---|
| Clientes | `GET /clientes`, `GET /clientes/:id`, `GET /clientes/cnpj/:cnpj` | `px_registry_clientes` |
| Endereços | `GET /clientes/:id/enderecos` | `px_registry_enderecos` |
| Contatos | `GET /clientes/:id/contatos` | `px_registry_contatos` |
| Conta Corrente | `GET /clientes/:id/conta-corrente` (saldo, limite, vencidos, bloqueio) | view `px_cliente_saldo` + `px_cliente_credito` |
| Lançamentos | `GET /clientes/:id/lancamentos` (paginado) | `px_cliente_lancamentos` |
| Empresas | `GET /empresas` | `empresas` |
| Usuários | `GET /usuarios`, `GET /usuarios/:id` (nome, foto, perfil, status, último acesso) | `profiles` + `user_roles` + `px_usuarios_meta` |
| Perfis | `GET /perfis`, `GET /perfis/:id/permissoes` | `px_perfis`, `px_perfil_permissoes` |
| Permissões | `GET /permissoes/check?user_id=&recurso=` | `has_role` / `has_system_access` |
| Tabelas de Frete | `GET /tabelas-frete` | `tms_tabela_frete` |
| Centros de Custos | `GET /centros-custo` | `categorias_custo` (revisar — talvez nova tabela) |
| Categorias | `GET /categorias` | `categorias_custo` |
| Produtos / Serviços / Fornecedores | placeholders versionados (`501 Not Implemented`) até o cadastro existir no PXOne |

Cada endpoint verifica **escopo** do `api_client` (ex.: `clientes:read`, `financeiro:read`). Resposta nunca inclui PII desnecessária; campos sensíveis (`cnpj` mascarado opcional via `?mascarar=1`).

---

## Fase 3 — Módulos de escrita (CRUD via API)

Permitir que sistemas externos criem/editem **através** da API, nunca direto no banco.

| Recurso | Endpoints |
|---|---|
| Clientes | `POST /clientes` (idempotente por CNPJ — se existe, retorna o existente), `PATCH /clientes/:id`, `POST /clientes/:id/inativar`, `POST /clientes/:id/reativar` |
| Endereços | `POST /clientes/:id/enderecos`, `PATCH /enderecos/:id`, `DELETE /enderecos/:id` |
| Contatos | idem endereços |
| Conta Corrente | **somente leitura** para sistemas externos. Lançamentos só são criados pelo próprio PXOne. |
| Usuários / Perfis / Permissões | criação só com escopo `admin:write`; demais sistemas apenas leem |

Reaproveitar as funções já existentes (`upsertCliente`, `criarEndereco`, etc) — a rota da API valida escopo, chama a função, devolve no envelope padronizado. Toda mutação registra em `px_audit_log` com `user_label = "via PX API · <sistema_key>"`.

---

## Fase 4 — Painel administrativo e governança

Tela em `/_authenticated/admin/px-api` para o operador do PXOne:
- Listar/criar `api_clients` (gera api_key + secret uma única vez).
- Definir escopos, rate-limit, ativar/desativar.
- Revogar tokens individuais (`px_api_tokens.revogado = true`).
- Visualizar logs (`px_api_logs`) com filtros por sistema, endpoint, status, período.
- Métricas: requisições/min, latência média, taxa de erro por sistema.

Documentação OpenAPI gerada estaticamente em `/api/public/v1/openapi.json` + página `/docs/px-api` renderizando Swagger UI (read-only).

---

## Detalhes técnicos

- **Stack:** TanStack Start server routes (`createFileRoute` em `src/routes/api/public/v1/*`). Nada de Supabase Edge Functions.
- **Cliente Supabase dentro da API:** publishable client para leituras com policies `TO anon` específicas para o role `service_role` da API; `supabaseAdmin` (import dinâmico dentro do handler) para escritas privilegiadas após validação de escopo.
- **JWT:** assinado com HS256 usando `PX_API_JWT_SECRET`. Claims: `sub=api_client_id`, `sk=sistema_key`, `scp=[...]`, `exp`, `jti`. Verificação manual com `crypto.subtle` (sem dependência Node-only).
- **Rate limit:** janela deslizante por sistema_key; primeira implementação em-DB (insert no `px_api_logs` + count nos últimos 60s); cache em memória de 30s para evitar consultas repetidas.
- **Idempotência:** `POST /clientes` aceita `Idempotency-Key`; reusa resposta anterior por 24h.
- **Paginação:** `{ data: [...], meta: { page, pageSize, total, hasMore } }` dentro do envelope.
- **Erros padronizados:** `code` enum (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`).
- **CORS:** desabilitado por padrão (API server-to-server). Liberado por origem somente para portais futuros via campo em `px_api_clients.allowed_origins[]`.

---

## Migrations (Fase 1)

```text
px_api_clients          (sistemas consumidores)
px_api_tokens           (refresh tokens / revogação)
px_api_logs             (auditoria de requisições)
GRANTs + RLS bloqueando acesso direto — apenas service_role escreve;
authenticated lê apenas no painel admin via has_role('master_admin'|'socio'|'diretor').
```

---

## Sugestão de execução

Confirmar este plano e eu inicio pela **Fase 1 (fundação + auth + envelope + logs + 1 endpoint de exemplo `GET /clientes`)** para validar o padrão. Depois replicamos para os demais módulos nas Fases 2–4.

Posso também, se preferir, **enxugar o escopo inicial** para apenas o que o PXComercial vai consumir primeiro (Clientes + Endereços + Contatos + Conta Corrente + Usuários + Permissões) e adiar Produtos/Serviços/Fornecedores até existirem cadastros próprios.
