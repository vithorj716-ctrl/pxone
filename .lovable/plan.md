
# PX Registry — Cadastro Inteligente de Clientes

Criar um serviço central de cadastro de pessoas jurídicas, compartilhado por todos os sistemas da PX Platform (PXLog, PXOne, PXMed, PXFarma). CNPJ é a chave única — um cliente nunca é duplicado.

## 1. Banco de dados (migration)

Nova tabela **`px_registry_clientes`** no schema `public`:

- `id` (uuid)
- `cnpj` (text, UNIQUE — apenas dígitos, 14 chars)
- `razao_social`, `nome_fantasia`, `situacao_cadastral`, `data_abertura`, `natureza_juridica`, `cnae_principal`, `cnae_descricao`
- Endereço: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`
- Comercial: `contato_nome`, `contato_cargo`, `telefone`, `whatsapp`, `email`, `observacoes`, `condicao_pagamento`, `tabela_frete_id` (fk opcional), `limite_credito` (numeric)
- Classificação: `categorias` (text[] — multi: cliente, fornecedor, transportadora, distribuidora, farmacia, hospital, clinica, industria, operador_logistico, outros)
- Auditoria: `created_by`, `updated_by`, `created_at`, `updated_at`, `api_payload` (jsonb — última resposta da API)
- RLS: todo authenticated lê/escreve; service_role full.
- Trigger `updated_at`.
- Índice em `cnpj`, GIN em `categorias`.

Nova tabela **`px_registry_vinculos`** (qual sistema usa qual cliente — opcional, p/ relatórios):
- `cliente_id`, `sistema_key` (pxlog/pxone/pxmed/pxfarma), `vinculado_em`, `vinculado_por`
- UNIQUE(cliente_id, sistema_key).

Compatibilidade com `tms_clientes` existente: adicionar coluna `registry_id uuid REFERENCES px_registry_clientes(id)` em `tms_clientes`. Nenhum dado existente é removido.

## 2. PX Registry — camada de serviço

`src/px-core/registry/cnpj-provider.ts` — interface `CnpjProvider` com `lookup(cnpj): Promise<CnpjData>`. Implementação default `BrasilApiProvider` (fetch `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`). Troca futura sem tocar consumidores.

`src/lib/px-registry.functions.ts` (server functions, `requireSupabaseAuth`):
- `lookupCnpj({ cnpj })` — valida formato + DV, chama provider, retorna dados normalizados. Não persiste.
- `findClienteByCnpj({ cnpj })` — retorna registro existente ou null.
- `upsertCliente({ ... })` — cria ou atualiza, preenche `created_by`/`updated_by`, retorna registro.
- `linkClienteToSistema({ cliente_id, sistema_key })` — registra vínculo.
- `listClientes({ categoria?, search?, sistema? })`.

Helpers em `src/lib/cnpj.ts`: `onlyDigits`, `isValidCnpj` (DV), `formatCnpj`.

## 3. UI — Novo Cliente

Nova rota **`/registry/clientes`** (lista global) e dialog **`<NovoClienteDialog>`** reaproveitável.

Fluxo do dialog:
1. Etapa 1 — só campo CNPJ + botão "🔍 Buscar Dados". Loading spinner.
2. Antes de chamar API, `findClienteByCnpj`. Se existir → toast "Este CNPJ já está cadastrado" + abre em modo edição/visualização.
3. Senão → `lookupCnpj`, preenche todos os campos (editáveis se vazios).
4. Se `situacao_cadastral` ≠ ATIVA → banner amarelo "Empresa {situacao}. Cadastro requer confirmação." + checkbox "Confirmo cadastro mesmo assim" (gating do submit; só usuários com role admin/socio/diretor liberam).
5. Etapa 2 — campos comerciais + categorias (multi-select).
6. Salvar → `upsertCliente` + `linkClienteToSistema` (sistema atual do contexto).

Componentes:
- `src/components/registry/novo-cliente-dialog.tsx`
- `src/components/registry/cliente-form.tsx`
- `src/routes/_authenticated/registry.clientes.tsx` (lista + filtros por categoria/sistema, abre dialog)

## 4. Integração com módulos existentes

- `/tms/clientes` (`tms.clientes.tsx`): trocar `CrudTable` por lista que lê de `px_registry_clientes` filtrando categorias relevantes (cliente, transportadora, distribuidora), com botão "Novo Cliente" abrindo `<NovoClienteDialog sistema="pxlog">`. Migration de compatibilidade: para `tms_clientes` sem `registry_id`, manter registro legado visível mas marcar "legado" e oferecer migração 1-clique (cria em `px_registry_clientes` via CNPJ se houver).
- Os demais sistemas (PXOne/PXMed/PXFarma) ainda não consomem; deixar o serviço pronto.

## 5. Validações

- CNPJ: regex 14 dígitos + cálculo de DV (rejeita inválido com mensagem clara).
- Situação inapta/baixada/suspensa: warning + bypass restrito por role.
- Email opcional mas validado quando preenchido (zod).
- Telefone/WhatsApp: máscara BR.

## 6. Auditoria

`created_by`/`updated_by` setados nos server functions a partir de `context.userId`. Resposta crua da API guardada em `api_payload` para auditoria/diagnóstico.

## Arquivos novos
- `supabase/migrations/*_px_registry.sql`
- `src/lib/cnpj.ts`
- `src/lib/px-registry.functions.ts`
- `src/px-core/registry/cnpj-provider.ts`
- `src/px-core/registry/brasilapi-provider.ts`
- `src/components/registry/novo-cliente-dialog.tsx`
- `src/components/registry/cliente-form.tsx`
- `src/routes/_authenticated/registry.clientes.tsx`

## Arquivos editados
- `src/routes/_authenticated/tms.clientes.tsx` (passa a usar registry)
- `src/components/tms/tms-shell.tsx` (link "Clientes" aponta para flow novo)

## Fora de escopo
- Migração em massa de `tms_clientes` legados (oferece-se 1-clique mas não automatiza tudo).
- Telas dedicadas em PXOne/PXMed/PXFarma — apenas o serviço fica pronto.
- Cache local persistente da API (consulta é sempre fresh; `api_payload` guarda último resultado).
