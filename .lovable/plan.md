## Refatoração Operacional do PXLog TMS

Transformar o TMS de um conjunto de CRUDs em um fluxo operacional real centrado em **Viagens**, com embarque inteligente, cancelamento de minuta, painel ao vivo e IA operacional.

---

### 1. Nova entidade: Viagens (banco)

Migration única criando:

- `tms_viagens` — código (`GOI-00021`), origem, destino, motorista_id, veiculo_id, placa, rota, status (`planejada|em_embarque|em_transito|finalizada|cancelada`), data_prevista, iniciada_em, finalizada_em, operador_id, totais previstos/embarcados (volumes, peso, cubagem), tempo_operacao_min, observacoes.
- `tms_viagem_minutas` — vínculo viagem↔minuta (define o "previsto").
- `tms_viagem_eventos` — auditoria de embarque/divergência/finalização.
- `tms_cancelamentos` — minuta_id, motivo (enum), motivo_texto, usuario_id, cancelado_em. Reaproveitada também para volumes deixados no HUB.
- Colunas novas em `tms_minutas`: `cancelada_em`, `cancelamento_motivo`, `cancelada_por`.
- Colunas em `tms_volumes`: `viagem_id`, `embarcado_em`, `embarcado_por`, `bloqueado`, `bloqueio_motivo`.
- RLS + GRANTs em todas as novas tabelas (authenticated + service_role).

Cancelamento **nunca** apaga registros — apenas muda status e grava auditoria. Embarque/faturamento bloqueados via checagem de status.

---

### 2. Eliminar módulo Conferência

- Remover rota `/tms/conferencia` do menu (`tms-shell.tsx`).
- Manter `ScanOperationPage` reutilizável (usado por recebimento/entrega/coleta).
- Embarque vira tela própria que **também conta como conferência**: ao bipar, grava eventos `conferido` + `embarcado` na mesma transação.

---

### 3. Nova tela `/tms/embarque` (fluxo guiado)

**Etapa 1 — Setup da viagem** (formulário inicial):
- Select Viagem existente (planejada) **ou** "Nova viagem".
- Select Motorista, Veículo (auto-preenche placa), Rota, Origem, Destino, Horário previsto.
- Multi-select de Minutas disponíveis no HUB atual → calcula automaticamente: qtd volumes prevista, peso previsto, cubagem prevista, clientes envolvidos.
- Botão "Iniciar Embarque" → cria/atualiza viagem com status `em_embarque`, vincula minutas, marca `iniciada_em`.

**Etapa 2 — Bipagem (tela operacional cheia)**:

Layout: scanner + lista de leituras à esquerda (2/3), **Painel da Viagem** à direita (1/3, sticky).

**Validações em cada bip** (server fn `bipVolumeEmbarque`):
1. Volume existe?
2. Pertence a alguma minuta da viagem?
3. Está no HUB atual (`hub_atual === origem`)?
4. Status não é `cancelado|bloqueado|entregue|embarcado`?
5. Minuta não cancelada?
6. Não foi bipado nessa viagem ainda (duplicado)?

Falha → toast vermelho + som longo + card vermelho na lista + razão clara. Sucesso → som curto + card verde + atualiza painel.

**Painel lateral ao vivo**:
- Viagem, motorista, veículo+placa, rota, origem→destino.
- Clientes (chips), Minutas (chips).
- Volumes previstos / embarcados / restantes (barra de progresso %).
- Peso previsto / embarcado, cubagem.
- Tempo decorrido (cronômetro vivo desde `iniciada_em`).
- Tabs: Pendentes · Divergentes · Duplicados · Bloqueados · Cancelados.

**Finalizar Embarque**:
- Se restantes > 0 → AlertDialog "Existem N volumes não embarcados. Finalizar mesmo assim?"
- Confirmação → cada volume pendente vira ocorrência (`tms_lm_ocorrencias` ou novo `tms_ocorrencias`) com motivo "ficou_no_hub", tracking atualizado, viagem `finalizada`, calcula `tempo_operacao_min`, gera **Resumo Operacional** persistido em `tms_viagem_eventos` tipo `resumo`.

**Áudio**: dois `<audio>` (beep curto OK / beep longo erro) via WebAudio inline (sem assets externos).

---

### 4. Cancelamento de Minuta

- Botão "Cancelar Minuta" em `/tms/minutas/$numero` (header, ao lado de Imprimir).
- Dialog com select de motivo (enum acima) + textarea opcional + confirmação dupla.
- Server fn `cancelarMinuta`: muda status para `cancelada`, marca todos os volumes como `cancelado`, grava `tms_cancelamentos`, emite evento.
- UI da minuta passa a mostrar banner vermelho "MINUTA CANCELADA — motivo · usuário · data". Botões Imprimir/Embarcar/Faturar ficam desabilitados.
- Lista de minutas: badge "Cancelada" + filtro.

---

### 5. Resumo Operacional (pós-viagem)

Rota `/tms/viagens/$codigo` exibe:
- Cabeçalho da viagem + status.
- KPIs: previstos, embarcados, faltantes, % conferência, peso previsto/embarcado, tempo, operador.
- Lista de volumes pendentes (com motivos).
- Timeline de eventos.
- Botão exportar/imprimir.

Lista `/tms/viagens` com filtros (status, motorista, data, divergências).

---

### 6. IA Operacional

Estender `src/lib/tms-ai.functions.ts` com novo contexto agregado:
- Divergência por viagem (`embarcados/previstos`).
- Erros por operador (bips com falha em `tms_viagem_eventos`).
- Cancelamentos por cliente e motivo (`tms_cancelamentos` + join com minuta→cliente).
- Volumes esquecidos no HUB (`status != entregue` e parados > X dias).
- Viagens incompletas, taxa média de conferência correta, top motivos de cancelamento.

Atalhos prontos no `/tms/ai-analyst` (perguntas sugeridas).

---

### 7. Menu/Shell

`tms-shell.tsx`:
- Remover "Conferência".
- Renomear/ordenar: Solicitações · Minutas · **Embarque** · Recebimento · Entrega · **Viagens** · Tracking · Ocorrências · Tabela de Frete · Clientes · Financeiro · IA.

---

### Detalhes técnicos

- Server fns novos (em `src/lib/tms-viagens.functions.ts` e `src/lib/tms-minutas.functions.ts`):
  `criarViagem`, `iniciarEmbarque`, `bipVolumeEmbarque`, `finalizarEmbarque`, `cancelarMinuta`, `getViagemPainel`, `listVolumesPendentes`.
- Todos com `requireSupabaseAuth`; mutações invalidam queries de viagem/minuta.
- Componentes novos: `EmbarqueSetup`, `EmbarqueScanner`, `PainelViagem`, `CancelarMinutaDialog`, `ResumoViagem`.
- Áudio: utilitário `playBeep(type)` usando `AudioContext` (sem arquivos).
- Rotas novas: `/tms/embarque` (substitui a atual), `/tms/viagens`, `/tms/viagens/$codigo`.
- Rota `/tms/conferencia` permanece no código (reutilizada por recebimento/embarque scan genérico antigo é removido do menu).

### Fora de escopo desta entrega

- Last Mile (já tem fluxo próprio).
- Refatoração de impressão de etiqueta (já feita).
- Alterações em pricing/financeiro além do bloqueio por minuta cancelada.
