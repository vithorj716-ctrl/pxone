# PXSales — Sistema comercial do Grupo PX

Novo sistema independente dentro da plataforma, usando a mesma conta de acesso, o mesmo cadastro de clientes (PX Registry) e os mesmos dados operacionais do PXLog. Nada do PXOne ou do PXLog é alterado no funcionamento atual.

## Entrega por etapas

Pelo tamanho, a construção é fatiada. Cada etapa deixa o sistema utilizável e testável.

**Etapa 1 — Fundação (esta rodada)**
- PXSales passa a existir no seletor de sistemas (Launcher), com nome, descrição, ícone e cor próprios.
- Tela de entrada própria em `/sales/login`: quem já está logado e tem acesso entra direto; quem não tem acesso vê um aviso de permissão, sem detalhes internos.
- Layout próprio (PXSalesShell): menu lateral no computador, navegação inferior no celular, busca, empresa ativa, perfil, notificações, trocar de sistema e sair.
- Estrutura de rotas `/sales/...` com as telas criadas e prontas para receber conteúdo.
- Permissões do PXSales registradas no sistema de perfis já existente.

**Etapa 2 — Clientes e contatos**
- Busca por CNPJ reaproveitando exatamente a consulta já existente (não haverá segunda implementação).
- Se o CNPJ já existe no cadastro, carrega; se não, consulta o provedor, o usuário revisa e salva no cadastro único, vinculado ao PXSales.
- Campos comerciais complementares (segmento, porte, origem, responsável, potencial, tags, condição de pagamento etc.).
- Lista de empresas com filtros e ficha 360º do cliente.

**Etapa 3 — Leads, oportunidades e pipeline** (kanban com arrastar entre etapas, atividades e follow-ups).

**Etapa 4 — Cotações e propostas** (reaproveitando tabela de frete e cálculo existentes).

**Etapa 5 — Portal público de cotação** (link com token, aceite/recusa/pedido de alteração, expiração).

**Etapa 6 — Tracking público** lendo os dados reais do PXLog, sem duplicar informação.

**Etapa 7 — Comissões configuráveis** com regras por vigência e congelamento do histórico.

**Etapa 8 — Relatórios, administração e auditoria.**

**Etapa 9 — Refino mobile/PWA e acabamento visual.**

## Detalhes técnicos (Etapa 1)

- `src/px-platform/systems.ts`: nova entrada `pxsales` (rota `/sales`, status ativo) + `systemFromPath()` reconhecendo `/sales`.
- Rotas: `src/routes/sales.login.tsx` (pública, `ssr: false`) e `src/routes/_authenticated/sales.*` para dashboard, leads, clientes (`$id`), contatos, oportunidades, cotações (`$id`), propostas (`$id`), followups, agenda, comissões, portal, tracking, relatórios, configurações. Rotas públicas futuras do portal ficam em `src/routes/portal.*`, fora da área autenticada.
- Gate de acesso: server function protegida que checa `has_system_access(user, 'pxsales')`; o shell bloqueia e redireciona para `/sales/login` quando negado. Validação repetida no backend, nunca só na interface.
- `src/components/pxsales/pxsales-shell.tsx`: shell próprio (sidebar + bottom nav + header), sem condicionais dentro do AppShell do PXOne.
- `src/pxsales/pxsales.permissions.ts`: catálogo `pxsales.*` mapeado para `px_perfis` / `px_perfil_permissoes` / `px_usuario_perfis`. Nenhum sistema de permissão paralelo.
- Lógica em `src/lib/pxsales.functions.ts`, `pxsales.types.ts` (e mais tarde `pxsales.portal.functions.ts`, `pxsales.commission.functions.ts`); páginas ficam finas.
- `src/px-integration/crm.ts` permanece intacto — os tipos do PXSales serão compatíveis para permitir extração futura para API própria.
- Banco na Etapa 1: apenas registro das permissões/perfis; tabelas `pxsales_*` entram nas etapas em que forem usadas, sempre com UUID, timestamps, `created_by`/`updated_by`, `empresa_id`, índices, GRANTs e RLS por usuário/empresa/sistema (sem `USING(true)`).

## Verificação ao final da Etapa 1

Usuário sem PXSales é bloqueado; usuário com acesso entra; Launcher, PXOne e PXLog continuam funcionando; sem rolagem horizontal no celular; build e lint limpos.
