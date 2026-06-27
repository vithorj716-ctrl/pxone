
# Refatoração Arquitetural — PX Platform

Reorganização puramente arquitetural. Nenhum módulo existente é alterado, removido ou tem sua lógica modificada. O resultado é uma plataforma que hospeda múltiplos **sistemas independentes** compartilhando o mesmo PX Core, banco e infraestrutura.

## Nova hierarquia

```text
PX Platform
   │
   ├── PX Identity        (login usuário/senha — sem cadastro público)
   │
   ├── Launcher           (escolha de sistema; pula se só houver 1)
   │
   ├── Sistemas
   │      ├── PXOne ERP   (intocado — todas as rotas e telas atuais)
   │      ├── PXLog TMS   (sistema independente, layout próprio)
   │      ├── PXMed       (reservado, não implementado)
   │      └── PXFarma     (reservado, não implementado)
   │
   └── Administração da Plataforma  (somente Diretor Geral)
```

Princípio de isolamento: dentro do PXOne o usuário NÃO vê nada do TMS, e vice-versa. Nada de menus mesclados. Trocar de sistema só pelo Launcher.

## Mudanças por camada

### 1. PX Identity (autenticação)
- Rota `/login` substitui a sessão interna silenciosa atual.
- Apenas usuário + senha (sem signup público, sem e-mail, sem OAuth).
- Seed automático do **Diretor Geral**: `vithorb` / `202406` (migration).
- Login mapeado para um e-mail interno `vithorb@px.local` na auth do backend (o usuário digita só "vithorb"; o front concatena o domínio interno antes de chamar o backend).
- Senha alterável posteriormente em "Minha conta".
- Mantém a conta interna atual viva para não quebrar dados já criados (NÃO removida).

### 2. Modelo de permissões
Novas tabelas (migration):
- `px_perfis` — perfis padrão + personalizados (Diretor Geral, Diretor, Gerente, Financeiro, Comercial, Operacional, Conferente, Motorista, Administrador).
- `px_perfil_permissoes` — por sistema + ação (`view`, `create`, `edit`, `delete`, `export`, `approve`).
- `px_usuario_sistemas` — sistemas autorizados por usuário (`pxone-erp`, `pxlog-tms`, futuros).
- `px_usuarios_meta` — login, cargo, situação, empresa, observações, perfil_id (complementa `profiles`; não toca `auth.users`).
- Função `has_system_access(user_id, sistema_key)` SECURITY DEFINER.
- Diretor Geral ganha acesso a **todos** os sistemas existentes via seed.

### 3. Registry de sistemas
Novo arquivo `src/px-platform/systems.ts`:
```ts
export const PX_SYSTEMS = [
  { key: "pxone-erp", nome: "PXOne ERP", cor: "...", rota: "/erp", ... },
  { key: "pxlog-tms", nome: "PXLog TMS", cor: "...", rota: "/tms", ... },
  { key: "pxmed",  status: "planejado", ... },
  { key: "pxfarma", status: "planejado", ... },
];
```
Mantém `src/px-core/registry.ts` (módulos internos) intocado — passa a ser submódulo do ERP.

### 4. Launcher
- Rota `/launcher`: cards com logo, nome, descrição, último acesso (em `px_usuario_sistemas.ultimo_acesso`).
- Se o usuário tem 1 sistema → redireciona direto.
- Ícone de engrenagem leva à **Administração** (apenas Diretor Geral).
- "Trocar de Sistema" disponível dentro de cada sistema → volta ao Launcher (sem signout).

### 5. Roteamento e isolamento
Reestruturar rotas sem mover arquivos de telas (apenas adicionar layouts pais para garantir isolamento):

- `src/routes/_authenticated/route.tsx` — passa a apenas exigir sessão e redirecionar para `/launcher` quando entrar em `/`.
- `src/routes/_authenticated/_erp.tsx` — layout que renderiza o `AppShell` atual do PXOne (menus do ERP). Verifica `has_system_access('pxone-erp')`.
- `src/routes/_authenticated/_tms.tsx` — layout próprio do TMS (nova shell, cores logística, menu só com itens TMS). Verifica `has_system_access('pxlog-tms')`.
- Rotas atuais do ERP (`empresas`, `custos`, `markup`, `business-plan`, `kpis`, `financial-intelligence.*`, `consolidado`, `aplicacoes`, `decisions`, `growth`, `risks`, `okr`, `payback`, `valuation`, `investor`, `documents`, `timeline`, `platform`, etc.) — **permanecem nos mesmos arquivos**, apenas re-registradas sob o pai `_erp` via route children (sem mover arquivos, evitando regressão). Mesmo URL público (`/empresas`, `/custos` …) — mas internamente o router checa `_erp`.
- Rotas TMS (`tms.*` atuais) — re-registradas sob o pai `_tms`.

Implementação concreta: aproveitando file-based routing, criamos pastas-pai pathless e movemos APENAS as importações via route IDs sem reescrever telas. Para evitar mover ~40 arquivos, optamos por **gates por componente** no shell:
- `AppShell` (PXOne) checa `current_system === 'pxone-erp'` e redireciona se não.
- Novo `TmsShell` (TMS) checa `current_system === 'pxlog-tms'`.
- Contexto `SystemContext` (`src/px-platform/system-context.tsx`) define qual sistema o usuário está usando (persistido em `sessionStorage`). Trocar = limpar e voltar ao Launcher.

Resultado prático: **zero arquivos de rotas movidos**, isolamento garantido por shell + contexto + checagem de permissão.

### 6. Identidade visual do TMS
Novo `TmsShell` (`src/components/tms/tms-shell.tsx`):
- Menu lateral próprio com **somente** rotas TMS (Dashboard, Solicitações, Minutas, Conferência, Embarque, Recebimento, Entregas, Tracking, Clientes, Tabela de Frete, Financeiro TMS, Ocorrências, Etiquetas).
- Paleta logística (laranja/âmbar + slate escuro), header próprio com logo "PXLog".
- Botão "Trocar Sistema" → limpa contexto, navega a `/launcher`.
- PXOne mantém `AppShell` atual sem nenhuma alteração visual; apenas ganha o mesmo botão "Trocar Sistema" no header. Os itens TMS são **removidos da navegação do AppShell**.

### 7. Administração da Plataforma
Rotas novas em `src/routes/_authenticated/admin.*`:
- `/admin` — overview.
- `/admin/usuarios` — CRUD de usuários (nome, login, senha, cargo, situação, empresa, observações), incluindo seleção de sistemas autorizados.
- `/admin/perfis` — CRUD de perfis e permissões por sistema/ação.
- Gate: `requireDiretorGeral` (server middleware + `beforeLoad` checando role).

## Detalhes técnicos

### Tabelas novas (migration única)
- `px_perfis (id, nome, descricao, is_system)`
- `px_perfil_permissoes (perfil_id, sistema_key, acao)`
- `px_usuario_perfis (user_id, perfil_id)`
- `px_usuario_sistemas (user_id, sistema_key, ultimo_acesso, ativo)`
- `px_usuarios_meta (user_id, login UNIQUE, cargo, situacao, empresa_id, observacoes)`
- Função `public.has_system_access(_uid uuid, _sys text) returns boolean`
- RLS + GRANT padrão; políticas leem perfil do próprio usuário; Diretor Geral via `has_role`.
- Seed: garante perfil "Diretor Geral", cria usuário `vithorb` (via `auth.users` raw insert com senha cifrada padrão Supabase + `px_usuarios_meta` + acesso a todos os sistemas).

### Arquivos novos
- `src/px-platform/systems.ts`
- `src/px-platform/system-context.tsx`
- `src/px-platform/permissions.functions.ts` (server fn `getMySystems`, `getMyPermissions`)
- `src/components/tms/tms-shell.tsx`
- `src/routes/login.tsx` (substitui `auth.tsx` redirect)
- `src/routes/_authenticated/launcher.tsx`
- `src/routes/_authenticated/admin.index.tsx`
- `src/routes/_authenticated/admin.usuarios.tsx`
- `src/routes/_authenticated/admin.perfis.tsx`
- `src/routes/_authenticated/conta.tsx` (trocar senha)
- migration SQL

### Arquivos editados (mínimo)
- `src/routes/_authenticated/route.tsx` — remove auto-login, exige sessão, redireciona a `/login` se anônimo e a `/launcher` se acessar `/` sem sistema escolhido.
- `src/routes/auth.tsx` — redireciona a `/login`.
- `src/routes/__root.tsx` — embrulha com `SystemProvider`.
- `src/components/app-shell.tsx` — remove itens TMS do menu, adiciona "Trocar Sistema", aplica gate de sistema = `pxone-erp`.
- Cada rota TMS atual recebe `TmsShell` ao invés de `AppShell` (somente troca de componente shell — telas inalteradas).

### Garantias
- ✅ PXOne 100% preservado: nenhuma alteração de cores, layout, dashboards, financeiro, custos, markup, business plan, SWOT, KPIs, FI.
- ✅ TMS preservado em funcionalidade; ganha shell própria.
- ✅ Compartilhamento de dados via PX Core inalterado (mesmas tabelas `empresas`, `custos`, etc.).
- ✅ Isolamento garantido por shell + contexto + permissão.
- ✅ Estrutura pronta para PXMed/PXFarma (basta adicionar entrada em `PX_SYSTEMS` + rotas).
- ✅ Sem cadastro público, sem OAuth, sem recuperação por e-mail.

## Fora de escopo desta fase
- PXMed e PXFarma (apenas reservados).
- Logs de auditoria detalhados por sistema.
- Customização visual avançada por sistema além de cores/logo.
- Sistemas de notificação cross-system.
