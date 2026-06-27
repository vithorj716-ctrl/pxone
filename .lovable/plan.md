# Módulo TMS — PXLog Transfer Hub

Novo módulo da PX Platform, totalmente integrado ao PX Core. Reutiliza Empresas, Clientes (custos), Usuários, Financeiro, IA e Dashboard. **Zero duplicação**: toda minuta entregue gera lançamento em `custos` (receita) automaticamente, alimentando Central de Custos, DRE, Markup e Dashboard Executivo.

Dado o escopo enorme, vou entregar uma **v1 funcional ponta-a-ponta** desta vez (fluxo completo coleta→entrega + financeiro + IA), com pontos de extensão claros para refinamento posterior.

## Escopo da v1 (entregue agora)

### 1. Migração — 5 tabelas novas + registro no PX Core
```text
tms_clientes              empresa_id, nome, cnpj, contato, telefone, email, endereco
tms_tabela_frete          cliente_id?, origem, destino, tipo_cobranca, valor_coleta,
                          valor_entrega, valor_kg, valor_m3, faixa_peso_min/max,
                          faixa_cubagem_min/max, prazo_dias, regra (jsonb), ativo
tms_minutas               numero (auto), cliente_id, remetente/destinatario (jsonb),
                          origem, destino, qtd_volumes, peso, cubagem, peso_cubado,
                          peso_taxado, valor_mercadoria, tipo_mercadoria, valor_frete,
                          prazo, necessita_coleta, data_coleta, status, responsavel_id,
                          observacoes, empresa_id
tms_volumes               minuta_id, numero (1..N), codigo (qr/barras único),
                          peso, altura, largura, comprimento, status, hub_atual
tms_eventos               minuta_id?, volume_id?, tipo (enum), origem_evento,
                          payload jsonb, operador_id, created_at
```
RLS authenticated, GRANTs, triggers updated_at, sequence para `numero` da minuta.

### 2. Registry — novo módulo
Adicionar entry `tms-pxlog` (status: `ativo`) em `src/px-core/registry.ts`.

### 3. Rotas (file-based, todas sob `_authenticated/tms.*`)
- `/tms` — **Dashboard Operacional** em tempo real (cards: coletas dia, em trânsito, aguardando entrega, entregues, ocorrências, faturamento dia, ranking clientes, linha do tempo recente).
- `/tms/clientes` — CRUD clientes TMS (CrudTable existente).
- `/tms/tabela-frete` — CRUD tabela de fretes com regras por cliente/origem/destino/peso/cubagem.
- `/tms/solicitacoes` — Listagem + form de nova solicitação de embarque.
- `/tms/solicitacoes/nova` — Form rápido: cliente, remetente/destinatário, volumes, dimensões. Calcula auto: cubagem (LxAxC/6000 m³), peso cubado, peso taxado (max peso×cubado), valor frete (lookup `tms_tabela_frete`), prazo. Ao salvar, cria minuta + N volumes com códigos únicos.
- `/tms/minutas/$numero` — Visualização da minuta com QR + código de barras (lib `qrcode` SVG inline), botão "Imprimir/PDF", lista de volumes, timeline de eventos, ações rápidas (conferir, embarcar, entregar).
- `/tms/etiquetas/$minuta` — Folha de etiquetas térmicas (uma por volume) com QR + código de barras, otimizada para impressão (CSS print).
- `/tms/conferencia` — Tela de bipagem ultrarrápida: input autofocus, scanner-friendly (lê código do volume, registra evento, mostra status, limpa input para próxima leitura). Funciona com leitor USB (que digita + Enter).
- `/tms/embarque` — Mesma UX (bipagem), tipo de evento = `embarcado`, conta peso/cubagem/qtd carregada.
- `/tms/recebimento` — Bipagem no HUB destino, identifica recebidos/faltantes/excedentes.
- `/tms/entregas` — Bipagem `entregue` + campo recebedor + foto/assinatura (upload simples opcional v1: só nome+timestamp).
- `/tms/tracking` — Busca por número de minuta ou código de volume; mostra timeline visual completa.
- `/tms/ocorrencias` — Form rápido vinculado a minuta/volume com tipo (avaria, extravio, recusa, etc.) → gera evento.
- `/tms/financeiro` — Lista de minutas com status financeiro (previsto/realizado/faturado); botão "Liberar faturamento" gera `INSERT INTO custos` (tipo `receita` via descrição, empresa_id da minuta, valor=valor_frete, categoria "TMS — Frete").

### 4. IA Operacional
Server function `askTmsAnalyst` em `src/lib/tms-ai.functions.ts`:
- Carrega snapshot via PX Core (custos + tms_minutas/eventos agregados, anonimizado)
- Chama `callPxAI` com contexto da empresa ativa
- Responde perguntas tipo "quais rotas estão atrasando?", "ranking de clientes", etc.
- Botão chat no Dashboard TMS.

### 5. Eventos & Tracking automáticos
Cada ação operacional grava em `tms_eventos` e atualiza `status` do volume/minuta. Tipo enum:
`solicitado | coleta_programada | coletado | recebido_hub_origem | conferido | etiquetado | embarcado | em_transferencia | recebido_hub_destino | separado | em_rota | saiu_entrega | entregue | ocorrencia | devolucao`

Tracking público (interno por enquanto): timeline com ícone, label, timestamp, operador.

### 6. Integração financeira sem duplicação
- "Liberar faturamento" cria 1 registro em `custos` (tabela existente) com descrição "TMS Minuta #N — Cliente X".
- Dashboard Executivo, Central de Custos, DRE, Markup já consomem `custos` → aparecem automaticamente.
- Coluna `origem_modulo` não existe; identificamos por prefixo da descrição.

### 7. Menu lateral
Adicionar grupo "Logística" no `app-shell.tsx` com sub-itens (Dashboard, Solicitações, Conferência, Embarque, Recebimento, Entregas, Tracking, Ocorrências, Tabela de Fretes, Clientes TMS, Financeiro TMS).

## Fora do escopo da v1 (refinamento posterior)

- Romaneios separados por veículo/motorista (entregue como agregação simples via embarques na v1)
- Upload real de foto/assinatura em entrega (placeholder de campo apenas; bucket de storage pode ser adicionado depois)
- Geolocalização automática
- Mapa operacional (placeholder de card; integração com lib de mapa fica para v2)
- Comprovantes em PDF (a minuta tem print-to-PDF nativo do browser na v1)
- OTIF, drill-down profundo, rankings avançados — v1 entrega os principais; resto sobre a mesma base de dados

## Arquivos

**Novos (~15):**
```
supabase/migrations/<ts>_tms_pxlog.sql
src/lib/tms.ts                        (helpers cubagem, peso taxado, lookup tabela frete, etiqueta SVG)
src/lib/tms-ai.functions.ts
src/components/tms/scan-input.tsx     (input ultrarrápido para bipagem)
src/components/tms/qr-label.tsx       (etiqueta térmica com QR)
src/components/tms/timeline.tsx
src/routes/_authenticated/tms.tsx                  (layout c/ Outlet)
src/routes/_authenticated/tms.index.tsx            (Dashboard)
src/routes/_authenticated/tms.clientes.tsx
src/routes/_authenticated/tms.tabela-frete.tsx
src/routes/_authenticated/tms.solicitacoes.tsx
src/routes/_authenticated/tms.solicitacoes.nova.tsx
src/routes/_authenticated/tms.minutas.$numero.tsx
src/routes/_authenticated/tms.etiquetas.$minuta.tsx
src/routes/_authenticated/tms.conferencia.tsx
src/routes/_authenticated/tms.embarque.tsx
src/routes/_authenticated/tms.recebimento.tsx
src/routes/_authenticated/tms.entregas.tsx
src/routes/_authenticated/tms.tracking.tsx
src/routes/_authenticated/tms.ocorrencias.tsx
src/routes/_authenticated/tms.financeiro.tsx
```

**Editados (mínimo):**
- `src/px-core/registry.ts` (adicionar entry)
- `src/components/app-shell.tsx` (grupo Logística)

**Dependência nova:** `qrcode` (geração de SVG/PNG inline para etiquetas).

## Garantias

- ✅ Não duplica clientes (usa nova `tms_clientes` ligada a `empresa_id`; opt-in para reaproveitar do CRM quando existir)
- ✅ Não duplica financeiro — tudo flui para `custos` existente
- ✅ Respeita empresa ativa do seletor multiempresa
- ✅ IA usa `callPxAI` com contexto de empresa
- ✅ Bipagem-first: telas operacionais com input autofocus, Enter dispara ação, sem mouse
- ✅ Zero alteração nos módulos atuais

Posso aplicar?
