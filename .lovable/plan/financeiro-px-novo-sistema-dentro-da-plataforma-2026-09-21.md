# Financeiro PX — novo sistema dentro da plataforma

## O que já existe hoje (auditoria feita antes de qualquer mudança)

- **Gestão** (fica como está): Central de Custos, Markup, DRE, DFC, ponto de equilíbrio, KPIs, visão consolidada. Hoje a "receita" da Gestão vem apenas dos snapshots de KPI digitados à mão.
- **Conta corrente do cliente** já existe (lançamentos e limite de crédito) e já recebe faturamento de outros sistemas por API. É a base natural do contas a receber — não será duplicada.
- **Comissões** já são apuradas e congeladas no PXSales, com regra histórica preservada. O Financeiro só vai pagar, nunca recalcular.
- **Operação (PXLog)**: minutas, entregas, comprovantes e tracking. Continuam sendo a fonte única.
- **Problema real encontrado**: na tela "Financeiro" do PXLog, ao faturar uma minuta o sistema grava a **receita do frete como se fosse um custo**. Isso distorce o DRE e a análise de custos. Será corrigido.
- **Risco de segurança encontrado**: lançamentos financeiros de cliente, limite de crédito e minutas hoje podem ser lidos e alterados por qualquer usuário logado, sem separação por empresa. Será fechado.

## Como o Financeiro vai se encaixar

Financeiro registra os fatos (a pagar, a receber, pagamentos, recebimentos, adiantamentos, folha, recibos, conciliação).
Gestão continua interpretando esses fatos (KPIs, DRE, DFC, markup, margem, ponto de equilíbrio). Nada de análise é duplicado no Financeiro.

Novo sistema registrado no mesmo mecanismo dos demais (sistema ativo, empresa, perfil, permissão, launcher), com rota própria `/financeiro` e menu próprio agrupado em: Visão geral · Movimentação · Pessoas e pagamentos · Comercial · Despesas e receitas · Conciliação · Documentos.

## Entrega em fases

**Fase 1 — Fundação e segurança**
- Registrar o sistema Financeiro (launcher, contexto de sistema, isolamento por rota, liberação por usuário).
- Catálogo de permissões `financeiro.*` (as 28 ações pedidas), presets por perfil e guarda de backend própria, no mesmo padrão já usado no PXSales.
- Corrigir o isolamento por empresa e as regras de acesso das tabelas financeiras existentes (conta corrente, crédito, minutas).

**Fase 2 — Movimentação**
- Contas financeiras (banco, caixa, carteira), categorias e centros de custo financeiros configuráveis.
- Contas a pagar e contas a receber com todos os campos pedidos, estados controlados (nada de "cancelado" virar "pago"), histórico de alterações e pagamento/recebimento parcial.
- Pagamentos e recebimentos gravados de forma atômica junto com baixa, status, movimento na conta e auditoria; proteção contra duplo clique e requisições repetidas.

**Fase 3 — Faturamento, comissões e receitas**
- Fluxo minuta entregue → faturamento → conta a receber → recebimento, substituindo a gravação de receita como custo (dados históricos preservados e reclassificados, nunca apagados).
- Comissões apuradas no PXSales chegam ao Financeiro como fila de pagamento (agendar, pagar, recibo, histórico).
- Receitas e despesas como fatos financeiros, com categorias cadastráveis.

**Fase 4 — Pessoas, recibos e conciliação**
- Colaboradores e prestadores (cadastro financeiro, sem virar RH), adiantamentos com fluxo solicitação → aprovação → pagamento → acerto, e pagamentos recorrentes.
- Folha/pagamentos: pessoa → período → lançamentos → descontos e adiantamentos → líquido → pagamento → recibo. Sem cálculos trabalhistas presumidos.
- Recibos numerados com PDF, reemissão sempre registrada.
- Conciliação manual (não conciliado, conciliado, divergente, ignorado) com arquitetura pronta para integração bancária futura.

**Fase 5 — Integração com a Gestão, relatórios e consolidação**
- Camada única de leitura que entrega ao DRE/DFC/KPIs os dados reais do Financeiro no lugar dos valores digitados.
- Relatórios financeiros com filtros compartilhados (empresa, período, cliente, fornecedor, categoria, centro de custo, status).
- Reorganização dos menus do PXOne (Cadastros · Comercial · Operação · Financeiro · Gestão · Relatórios · Configurações) e aba Financeiro na visão 360º do cliente.
- Marcação do que virou legado (ex.: motor de tabela de frete antigo) com o mapa de dependências no código; remoção só depois de migrar consumidores e validar.

## Detalhes técnicos

- Novo `sistema_key` `pxfin` em `PX_SYSTEMS` + branch em `systemFromPath` + liberação via `px_usuario_sistemas`.
- Catálogo `src/financeiro/financeiro.permissions.ts` e guarda `src/lib/financeiro-guard.ts` espelhando `pxsales-guard.ts` (`px_has_permission`, `px_can_access_empresa`, `px_user_empresas`, `auditar` em `px_audit_log`).
- Novas tabelas, todas com `empresa_id NOT NULL`, FK, índices, GRANTs e RLS via função `financeiro_can(acao, empresa_id)`:
  `fin_contas`, `fin_categorias`, `fin_centros_custo`, `fin_contas_pagar`, `fin_contas_receber`, `fin_movimentos`, `fin_lancamento_historico`, `fin_pessoas`, `fin_adiantamentos`, `fin_folha_periodos`, `fin_folha_itens`, `fin_recibos`, `fin_conciliacao`, `fin_faturamentos`.
- Reuso obrigatório: clientes em `px_registry_clientes`, operação em `tms_*`, comissões em `pxsales_comissoes` (apenas leitura + status de pagamento), crédito/conta corrente em `px_cliente_credito`/`px_cliente_lancamentos` como espelho do a receber.
- Toda mutação sensível via RPC `SECURITY DEFINER` transacional (baixa + movimento + status + auditoria + recibo num só commit), com chave de idempotência por operação.
- Server functions protegidas (`requireSupabaseAuth` + guarda + escopo de empresa resolvido no servidor, nunca vindo do navegador).
- Portal do cliente não ganha nenhum dado financeiro interno; qualquer exposição futura passa por DTO público dedicado.
- UI densa no padrão atual: filtros no topo, cards de totais, tabela compacta, seleção múltipla, ações em lote e drawer lateral de detalhe.
- Testes ao final de cada fase: isolamento entre empresas, permissões, parciais, vencimento, cancelamento, estorno, adiantamento, recibo, comissão, faturamento, conciliação, concorrência e duplo clique.

## Fora de escopo

DRE, DFC, markup, margem, ponto de equilíbrio e KPIs continuam exclusivamente na Gestão. Nenhuma folha trabalhista com encargos legais. Nenhuma integração bancária automática nesta entrega.
