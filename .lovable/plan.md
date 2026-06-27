## Last Mile (Entregas Finais) — novo módulo do PXLog TMS

Módulo independente dentro do PXLog TMS, totalmente integrado ao PX Core (Clientes, Minutas, Tracking, Financeiro, Central de Custos, IA, Dashboard). Sem duplicar cadastros: reaproveita `tms_clientes`, `tms_minutas`, `tms_volumes`, `tms_eventos`, `custos`.

### 1. Modelo de dados (migration)

Tabelas novas em `public.*` (com GRANTs + RLS scopada a `authenticated` via `has_system_access('pxlog-tms')`):

- `tms_lm_motoristas` — nome, cpf, cnh, telefone, ativo
- `tms_lm_veiculos` — placa, modelo, capacidade_kg, capacidade_m3, ativo
- `tms_lm_rotas` — numero (auto), data, motorista_id, veiculo_id, cidade, status (`planejada|separando|carregando|em_rota|finalizada|atrasada|ocorrencia`), hora_saida, hora_prevista, hora_finalizada, valor_rota, observacoes
- `tms_lm_entregas` — rota_id, minuta_id (FK opcional para `tms_minutas`), destinatario, telefone, endereco, cidade, cep, lat, lng, qtd_volumes, peso, cubagem, valor_mercadoria, prioridade (`baixa|media|alta|urgente`), janela_inicio, janela_fim, observacoes, status (`aguardando_separacao|separado|carregado|saiu_entrega|tentativa_1|tentativa_2|entregue|recusado|ausente|endereco_incorreto|avaria|devolucao`), ordem, tempo_estimado_min, distancia_km, concluida_em
- `tms_lm_volumes` — entrega_id, codigo (reaproveita códigos PXLOG quando vier de minuta), status, separado_em, carregado_em
- `tms_lm_eventos` — entrega_id, tipo, payload (jsonb), criado_por, created_at — espelhado em `tms_eventos` quando vinculado a minuta
- `tms_lm_ocorrencias` — entrega_id, tipo, descricao, foto_url, created_at
- `tms_lm_comprovantes` — entrega_id, recebedor_nome, recebedor_doc, foto_mercadoria, foto_fachada, assinatura_base64, observacoes, lat, lng, created_at

Trigger: ao status entrega → `entregue`, inserir evento em `tms_eventos` e (se rota faturada) gerar `custos` (receita Last Mile) — espelhando padrão TMS atual.

### 2. Registro do submódulo

- `src/components/tms/tms-shell.tsx` — adicionar item "Last Mile" no menu TMS (grupo separado abaixo de Transferências).
- Rotas sob `src/routes/_authenticated/tms.lm.*` reutilizando `TmsShell` com `subtitle="Last Mile"` e cor de destaque verde-limão para diferenciar.

### 3. Rotas (file-based)

```
tms.lm.index.tsx              → /tms/lm           Dashboard operacional
tms.lm.rotas.tsx              → /tms/lm/rotas     Grid de cards (tela principal)
tms.lm.rotas.$numero.tsx      → detalhe + cards de entrega + mapa
tms.lm.entregas.tsx           → busca/filtros globais de entregas
tms.lm.separacao.tsx          → scan rápido (bipa etiqueta → identifica)
tms.lm.carregamento.tsx       → scan por veículo + romaneio PDF
tms.lm.tracking.tsx           → timeline por minuta/etiqueta
tms.lm.ocorrencias.tsx        → registro rápido com tipos pré-definidos
tms.lm.comprovantes.tsx       → galeria + busca + PDF
tms.lm.relatorios.tsx         → dashboard executivo + drilldown
tms.lm.configuracoes.tsx      → motoristas, veículos, janelas, tipos
tms.lm.motorista.$rotaId.tsx  → interface mobile do motorista (próxima entrega, botões grandes)
```

### 4. UX-chave (não-tabela)

- **`RotaCard`** (`src/components/tms/lm/rota-card.tsx`): card grande, cor por status (mapa de cores especificado), barra de progresso, badge de atrasos, 5 botões rápidos (Abrir/Mapa/Comprovantes/Ocorrências/Finalizar).
- **`EntregaCard`** (`src/components/tms/lm/entrega-card.tsx`): card por entrega com QR, prioridade colorida, janela de atendimento, ETA.
- **`ScanSeparacao` / `ScanCarregamento`**: reaproveita `ScanInput` existente; resolve volume por código PXLOG e mostra contexto (cliente/destino/rota) sem digitação.
- **`PodCapture`**: form de comprovante com upload de fotos (Lovable Cloud Storage bucket `pod-lastmile`), canvas de assinatura, geolocalização opcional.
- **`MotoristaView`**: tela única com próxima entrega, mapa embutido (link `https://www.google.com/maps/dir/?api=1&destination=lat,lng`), botões grandes: Cheguei / Iniciar / Concluir / Ocorrência / Foto / Assinatura.
- **Dashboard**: 14 cards de KPI + placeholder de mapa (link externo, sem libs nativas pesadas no Worker). Drilldown via Link tipado.

### 5. IA Last Mile

`src/lib/lm-ai.functions.ts` — `askLastMileAnalyst` server fn (mesmo padrão de `askTmsAnalyst`):
- agrega `tms_lm_rotas`, `tms_lm_entregas`, `tms_lm_ocorrencias`, OTIF, tempo médio
- system prompt: especialista em última milha; responde atrasos, produtividade, otimização de rota, risco de não conclusão
- usa `callPxAI` com `modulo: "tms-lm"`, modo `analitico`

### 6. Storage

Criar bucket privado `pod-lastmile` via tool `supabase--storage_create_bucket`, com RLS em `storage.objects` restrita a `authenticated` + path `entrega_{id}/*`. Comprovantes em PDF gerados client-side (jsPDF já no padrão do projeto) ou server fn que monta HTML imprimível.

### 7. Integrações automáticas

- **Tracking**: cada evento Last Mile insere em `tms_lm_eventos` e, quando vinculado a minuta, em `tms_eventos` (timeline já existente continua funcionando).
- **Financeiro / Central de Custos**: ao concluir rota com flag faturável, gerar linha em `custos` (`centro_custo: "Receita Last Mile"`).
- **Dashboard global TMS**: estender `src/routes/_authenticated/tms.index.tsx` com bloco Last Mile (sem remover nada).
- **Clientes / Minutas / Etiquetas**: relacionamento via FK; nenhuma duplicação.

### 8. Fora de escopo (futuro)

- Roteirização automática real (apenas estrutura para ordem manual + ETA por entrega)
- Tracking público para destinatário (link compartilhável) — fica para próxima iteração
- Push notifications nativas

### Resumo técnico

8 tabelas novas + 1 bucket + 12 rotas + 6 componentes específicos + 1 server fn de IA + edição mínima de `tms-shell.tsx` e `tms.index.tsx`. Zero remoção. Zero alteração no PXOne ERP. Reutiliza `ScanInput`, `QrLabel`, `Timeline`, `TmsShell`, `callPxAI` e o módulo de custos existente.