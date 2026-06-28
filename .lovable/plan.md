# Refatoração da Tela "Nova Solicitação"

Escopo enorme com dependências que ainda não existem no banco. Proponho dividir em 3 fases entregáveis, cada uma funcional por si.

## Dependências que faltam hoje

- **Endereços do cliente** — não existe tabela. Hoje `px_registry_clientes` guarda apenas 1 endereço.
- **Contatos do cliente/endereço** — não existe tabela. Hoje só `contato_nome/telefone/email` no cliente.
- **Conta Corrente / limite / bloqueios** — Fase 2 do plano anterior, ainda não implementada.
- **Tabela de frete vinculada ao cliente** — `tms_tabela_frete` existe, mas sem vínculo padrão por cliente.
- **Condição de pagamento / prazo padrão** — não existem campos.

Sem isso, "preenchimento automático" vira só placeholder.

---

## FASE A — Cadastros de suporte (fundação, esta rodada)

Migrations no PX Core:

- `px_registry_enderecos` — múltiplos endereços por cliente: `tipo` (matriz/filial/cd/hospital/farmacia/outro), `apelido`, CEP, logradouro, número, complemento, bairro, cidade, UF, ponto_referencia, observacoes, janela_recebimento, restricoes (text[]), is_padrao_remetente, is_padrao_destinatario.
- `px_registry_contatos` — múltiplos contatos por endereço: `setor` (recebimento/compras/expedicao/financeiro/outro), nome, telefone, whatsapp, email, is_principal.
- Campos novos em `px_registry_clientes`: `tabela_frete_id`, `condicao_pagamento`, `prazo_padrao_dias`, `observacoes_comerciais`.

UI:
- Aba **"Endereços"** no `NovoClienteDialog` — listar/criar/editar/remover endereços com seus contatos aninhados.
- Aba **"Comercial"** — tabela de frete padrão, condição de pagamento, prazo, observações comerciais.
- Migração suave do endereço atual do cliente para a nova tabela (cria 1 endereço "Matriz" automaticamente).

## FASE B — Refatoração da tela Nova Solicitação (próxima rodada)

`src/routes/_authenticated/tms.solicitacoes.nova.tsx` reescrita:

```text
┌─────────────────────────────────────────┬──────────────────┐
│ 1. Cliente Contratante [combobox]       │  RESUMO          │
│    └ carrega: tabela, condição, prazo,  │  Cliente: ...    │
│      obs comerciais, status financeiro  │  Pagador: ...    │
├─────────────────────────────────────────┤  Tabela: ...     │
│ 2. Pagador do Frete [select]            │  Peso: ...       │
│    Remetente | Destinatário | Terceiro  │  Cubagem: ...    │
│    | Contratante | Outro cliente        │  Peso Taxado:... │
│    └ Card Conta Corrente (Fase 3)       │  Frete: ...      │
├─────────────────────────────────────────┤  Prazo: ...      │
│ 3. REMETENTE [Card de Endereço]         │  Limite: ...     │
│    [Trocar Endereço] [+ Novo]           │  Situação: ●     │
│    └ Contato: [select de contatos]      │                  │
├─────────────────────────────────────────┤                  │
│ 4. DESTINATÁRIO [Card de Endereço]      │                  │
│    + janela recebimento + restrições    │                  │
├─────────────────────────────────────────┤                  │
│ 5. MERCADORIA                           │                  │
│    descrição, vols, peso, cubagem,      │                  │
│    valor NF, nº NF, CT-e, tipo          │                  │
└─────────────────────────────────────────┘
```

Componentes novos:
- `<EnderecoSelector cliente_id role="remetente|destinatario">` — combobox com nome/cidade/UF/tipo + botão "Cadastrar novo".
- `<EnderecoCard>` — exibe endereço selecionado, com "Editar (só nesta minuta)" e "Trocar endereço".
- `<ContatoSelector endereco_id>` — picker de contatos por setor.
- `<PagadorSelector>` + `<ResumoLateral>` (sticky).

Regra crítica: editar dados de endereço na minuta NÃO altera o cadastro — vira snapshot na própria minuta (campos já existem em `tms_minutas`).

## FASE C — Conta Corrente + Bloqueio integrado (Fase 2/3 do plano anterior)

- Tabelas `px_cliente_credito`, `px_cliente_lancamentos`, view `px_cliente_saldo`.
- Card de status financeiro no `PagadorSelector` (Limite / Utilizado / Disponível / Vencido).
- Guard de bloqueio: card vermelho "CLIENTE BLOQUEADO" antes de salvar, com ações **Trocar pagador / Solicitar liberação / Continuar (autorizado)**.
- Semáforo no resumo lateral.

---

## Detalhes técnicos

- Tudo em PX Core (`px_registry_*`) → reusável por PXLog/PXMed/PXFarma.
- RLS: `authenticated` + `service_role` em todas; `anon` nunca.
- `syncTmsCliente` continua espelhando para `tms_clientes` (FK das minutas).
- `tms_minutas` ganha `remetente_endereco_id` e `destinatario_endereco_id` (opcionais, para auditoria do endereço-origem). Os campos textuais atuais continuam sendo o snapshot.
- Combobox usando `cmdk` (já no projeto via shadcn `Command`).

---

**Posso começar pela Fase A agora?** Responda "sim" ou diga o que ajustar. Fases B e C nas próximas rodadas para manter cada entrega revisável e testável.
