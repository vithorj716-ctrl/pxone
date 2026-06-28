Esta é uma refatoração estrutural grande. Proponho dividir em **3 fases entregáveis**, cada uma funcional por si. Confirme a fase 1 e seguimos.

---

## FASE 1 — Fundação (entrego nesta rodada)

### 1.1 Campos numéricos padronizados (global)
- Criar `src/components/ui/numeric-input.tsx` com variantes: `currency` (BRL), `weight` (kg), `volume` (m³), `percent`, `integer`, `decimal`.
- CSS global em `src/styles.css` removendo setas: `input[type=number]::-webkit-{inner,outer}-spinner-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; }`
- Comportamentos: `inputMode="decimal"`, seleciona tudo no foco, aceita colar, formatação on-blur, validação em tempo real.
- Substituir os `type="number"` mais sensíveis (frete, peso, cubagem, limite_credito, valor_mercadoria) — os demais herdam o CSS global automaticamente.

### 1.2 CRUD padrão + Histórico (PX Core)
- Migration: tabela `px_audit_log` (entity_type, entity_id, action `create|update|inactivate|reactivate|duplicate`, diff jsonb, user_id, created_at).
- Adicionar colunas `ativo boolean default true`, `inativado_em`, `inativado_por` em `px_registry_clientes`.
- Helper `src/lib/px-audit.ts` + server fn `logAudit` chamado nos upserts.
- Componente `<HistoricoTab entityType entityId />` reutilizável.

### 1.3 Ações padrão no cadastro de clientes
- Botões: Visualizar, Editar, Duplicar, Inativar/Reativar.
- Aba "Histórico" no `NovoClienteDialog` (já estruturado em tabs).
- Indicador visual de status (verde/amarelo/vermelho/cinza) na listagem.

---

## FASE 2 — Conta Corrente do cliente (próxima rodada)

- Migrations:
  - `px_cliente_credito` (cliente_id, limite, situacao `normal|bloqueado_manual|inativo`, bloqueado_por, motivo_bloqueio)
  - `px_cliente_lancamentos` (cliente_id, data, tipo `debito|credito`, documento, descricao, valor, origem `tms|pxone|manual`, sistema_key, ref_id, user_id, situacao `aberto|pago|vencido|cancelado`, vencimento)
  - `px_cliente_liberacoes` (auditoria de exceções: cliente_id, embarque_id, user_id, motivo)
  - View `px_cliente_saldo` calculando: utilizado, disponível, vencido, em aberto, maior atraso, último pagamento.
- Server fns: `getContaCorrente`, `listLancamentos`, `setLimiteCredito`, `bloquearCliente`, `desbloquearCliente`, `lancarDebito`, `lancarCredito`, `checkEmbarqueAllowed`, `liberarEmbarqueManual`.
- Aba "Conta Corrente" no dialog do cliente: KPIs + extrato com filtros.

---

## FASE 3 — Integração operacional + IA + Dashboard

- Hook no faturamento TMS (`tms.financeiro.tsx`) → gera débito automático ao faturar minuta; pagamento gera crédito e libera limite.
- Guard no embarque (`tms.embarque.tsx`): antes de embarcar, chama `checkEmbarqueAllowed` → se bloqueado, abre dialog "EMBARQUE BLOQUEADO" com motivo, limite, utilizado, saldo, e ações (Cancelar / Solicitar liberação / Abrir CC). Liberação só com role autorizada (registra auditoria).
- Indicador financeiro (semáforo) onde cliente aparece (listagens, minutas, embarque).
- Rota `/financeiro/dashboard` com KPIs (bloqueados, utilizado, vencido, top devedores, maior atraso, recebido no mês).
- Estender `tms-ai.functions.ts` com contexto de crédito para responder as perguntas do item 13.

---

## Detalhes técnicos relevantes
- Tudo em `px_*` no PX Core → reutilizado por PXLog/PXOne/PXMed/PXFarma via `sistema_key`.
- RLS: todas as tabelas com `authenticated` + `service_role`; liberações exigem `has_role('admin'|'gerente'|'financeiro')`.
- Lançamentos imutáveis (estorno via lançamento contrário) para preservar trilha de auditoria.
- View materializada não — usar view normal para refletir saldo em tempo real.

---

**Posso começar pela Fase 1 agora?** Responda "sim" ou diga o que ajustar. Fases 2 e 3 viram nas próximas rodadas para manter cada entrega revisável.