# Evolução PXOne → PX Platform Multiempresa

Atualização **aditiva**: nenhum módulo atual é alterado, nenhuma tabela existente é quebrada. A camada nova introduz multiempresa real, alternância de contexto, gestão de aplicações por empresa e visão consolidada do grupo.

## Princípio diretor

A tabela `empresas` já existe e é referenciada por `custos`, `kpis`, `markup_calculations`, `documents`, etc. Vamos **enriquecer** esse cadastro (sem quebrar nada) e adicionar:

1. Um **seletor de empresa global** no topo (com modo "Grupo consolidado").
2. Um **filtro de contexto** que módulos novos respeitam — módulos atuais continuam mostrando "tudo" como hoje, mas passam a destacar a empresa ativa quando ela existir.
3. Uma camada de **habilitação de aplicações por empresa** (Module Registry do PX Core × empresa).
4. Uma **Visão Consolidada do Grupo** com indicadores agregados e ranking entre empresas.

## O que será adicionado

### 1. Enriquecimento da tabela `empresas` (migração aditiva)
Adicionar colunas opcionais — todas nullable, defaults seguros, zero impacto no que existe:

```text
razao_social text · nome_fantasia text · cnpj text · segmento text
logo_url text · cor_primaria text · cor_secundaria text
situacao text DEFAULT 'ativa' · configuracoes jsonb DEFAULT '{}'
```

Tabelas novas:
- `px_filiais` (empresa_id FK, nome, cidade, uf, cnpj, ativo)
- `px_empresa_modulos` (empresa_id FK, modulo_key, ativo, habilitado_em) — controla quais módulos do Registry estão ligados por empresa
- `px_shared_resources` (recurso, empresa_origem_id, empresas_compartilhadas uuid[], tipo) — opt-in de compartilhamento de clientes/fornecedores/produtos/etc.

Todas com GRANTs + RLS authenticated.

### 2. Contexto de empresa global (frontend)
Novo `src/px-core/empresa-context.tsx`:
- `<EmpresaProvider>` no `__root.tsx`
- `useEmpresaAtiva()` → `{ empresa | null, isGrupo, setEmpresa, listaEmpresas }`
- Persiste seleção em `localStorage` (`px:empresa-ativa`)
- Modo "Grupo" (`empresa = null`, `isGrupo = true`) = visão consolidada

### 3. Seletor de empresa no header
Adicionar dropdown no header do `app-shell.tsx`:
- Mostra logo + nome fantasia da empresa ativa
- Opção "🏢 Visão do Grupo" no topo
- Lista todas as empresas ativas
- Aplica cor primária da empresa como acento visual sutil (variável CSS `--px-empresa-accent`)
- Mobile: ícone com sheet drawer

### 4. Módulo "Empresas" enriquecido (`/empresas`)
A rota já existe (CRUD simples). **Não vou substituir** — vou estender:
- Adicionar todos os novos campos no formulário (razão social, CNPJ, segmento, logo, cores, situação)
- Adicionar aba "Filiais" e aba "Aplicações habilitadas" por empresa
- Mantém compatibilidade total com o uso atual

### 5. Nova rota "Aplicações" (`/aplicacoes`)
Lista todas as aplicações do `PX_MODULES` registry com:
- Nome, descrição, versão, status, dependências, permissões
- Quantas empresas usam (count em `px_empresa_modulos`)
- Última atualização
- Por empresa ativa: toggle ativar/desativar

### 6. Visão Consolidada do Grupo (`/platform/consolidado`)
Quando "Visão do Grupo" está ativa, mostra:
- Faturamento, lucro, custos, EBITDA agregados (a partir do que já existe em `custos` + `kpis` + `markup_calculations`)
- Ranking de empresas por desempenho
- Participação % de cada empresa
- Comparativos lado a lado
- Toggle "Consolidado ↔ Por empresa"

### 7. IA Corporativa com contexto de empresa
Atualizar `src/px-core/ai/core.ts` (a função `callPxAI` já é nova/opt-in) para aceitar `empresaId | "grupo"`:
- Quando empresa específica: prompt inclui "Análises devem considerar APENAS dados de {nome}"
- Quando grupo + autorização explícita: prompt permite comparativos entre empresas
- Server functions atuais (`askAnalyst`, `askFinancialAdvisor`, etc.) **não são alteradas** — apenas ganham um parâmetro opcional `empresaId` que, se enviado, filtra os dados carregados antes de chamar a IA

### 8. Arquitetura "Empresa → Aplicações → Dados"
Documentar no `.lovable/plan.md` e expor helpers em `src/px-core/`:
- `getEmpresaModulos(empresaId)`
- `isModuloHabilitado(empresaId, key)`
- `getRecursosCompartilhados(tipo, empresaId)`

## Compatibilidade

- ✅ Módulos atuais (Custos, Markup, Financial Intelligence, Dashboard, KPIs, etc.) continuam funcionando **sem alteração**.
- ✅ Empresas existentes continuam válidas — só ganham campos novos opcionais.
- ✅ Quando nenhuma empresa está selecionada (estado atual padrão), tudo se comporta como hoje.
- ✅ Quando uma empresa é selecionada, módulos novos filtram automaticamente; módulos atuais ignoram o filtro (não quebram).

## Migração de banco (única, aditiva)

```sql
ALTER TABLE public.empresas
  ADD COLUMN razao_social text,
  ADD COLUMN nome_fantasia text,
  ADD COLUMN cnpj text,
  ADD COLUMN segmento text,
  ADD COLUMN logo_url text,
  ADD COLUMN cor_primaria text,
  ADD COLUMN cor_secundaria text,
  ADD COLUMN situacao text NOT NULL DEFAULT 'ativa',
  ADD COLUMN configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.px_filiais (...);            -- + GRANTs + RLS
CREATE TABLE public.px_empresa_modulos (...);    -- + GRANTs + RLS
CREATE TABLE public.px_shared_resources (...);   -- + GRANTs + RLS
```

## Arquivos novos

```text
src/px-core/empresa-context.tsx
src/px-core/api/empresas.functions.ts       (list+enriched)
src/px-core/api/empresa-modulos.functions.ts
src/px-core/api/consolidado.functions.ts
src/components/empresa-selector.tsx
src/routes/_authenticated/aplicacoes.tsx
src/routes/_authenticated/platform.consolidado.tsx
supabase/migrations/<ts>_px_multiempresa.sql
```

## Arquivos editados (mínimo)

- `src/routes/__root.tsx` → envolver com `<EmpresaProvider>`
- `src/components/app-shell.tsx` → adicionar `<EmpresaSelector>` no header + 2 itens de menu ("Aplicações", "Consolidado")
- `src/routes/_authenticated/empresas.tsx` → adicionar campos novos no formulário CRUD existente
- `.lovable/plan.md` → atualizar

Nada além disso.

## Garantias

- ✅ Zero alteração visual/funcional nos módulos existentes
- ✅ Zero perda de dados — todas as colunas novas são opcionais
- ✅ Isolamento de dados preparado (FK `empresa_id` já existe nas tabelas principais)
- ✅ Compartilhamento opt-in via `px_shared_resources`
- ✅ IA recebe contexto da empresa ativa
- ✅ Visão consolidada como modo separado, não substitui nada
- ✅ Arquitetura pronta para PXSales/PXTMS/etc. sem refactor

Posso aplicar?
