## Financial Intelligence Suite — Submódulo do Markup Engine

Novo submódulo dentro do Markup Engine com **4 telas integradas** + IA Financeira, alimentado 100% pelos dados já existentes (custos, empresas, markup, KPIs, business plan, valuation, payback).

### Arquitetura

```
src/routes/_authenticated/markup/
  └─ financial-intelligence/
      ├─ route.tsx           (layout com sub-tabs)
      ├─ index.tsx           (CEO Cockpit — padrão)
      ├─ dre.tsx             (DRE Gerencial)
      ├─ dfc.tsx             (DFC Inteligente)
      └─ break-even.tsx      (Ponto de Equilíbrio + Simulador)

src/lib/
  ├─ financial-intelligence.ts            (núcleo: consolidação de dados, fórmulas)
  ├─ financial-intelligence.functions.ts  (server fns: carregar dados agregados)
  └─ financial-ai.functions.ts            (IA Financial Advisor — Gemini com resumo agregado)
```

Adicionar item "Financial Intelligence" no submenu do Markup Engine (sidebar/app-shell) e atalho na própria página `/markup`.

### 1. DRE Gerencial (`/markup/financial-intelligence/dre`)

- **Consolidação automática**: lê `custos`, `markup_calculations`, `empresas`, `kpi_snapshots`. Classifica linhas de `custos` por `categoria`/`tipo` em: Devoluções, Impostos, Custos Operacionais, Despesas Operacionais, Administrativas, Financeiras, Depreciação/Amortização.
- **Receita Bruta** derivada de KPIs de faturamento (`kpi_snapshots` com nome `faturamento`/`receita`) + somatório de markup quando houver volume.
- **Cascata DRE**: Receita Bruta → Líquida → Lucro Bruto → EBITDA → EBIT → Lucro Líquido.
- **Dashboard** com cards (Receita, Lucro, EBITDA, Margens, ROI, ROE), **Waterfall Chart** (recharts), comparativos mês/ano e por empresa (BarChart agrupado).
- **Filtros**: período, empresa, unidade.
- **IA DRE** (botão "Analisar com IA"): envia resumo agregado (não linhas) → respostas estruturadas: variações, top categorias de impacto, saúde EBITDA, recomendações.
- Botão "Exportar" (Executive Share da Fase 1).

### 2. DFC Inteligente (`/markup/financial-intelligence/dfc`)

- Classifica lançamentos de `custos` em **Operacional / Investimento / Financiamento** via mapa de categorias (configurável no código; investimento = capex/ativo, financiamento = empréstimo/dividendos).
- Calcula: Entradas, Saídas, Saldo Inicial/Final, Fluxo Livre, Acumulado, Capital de Giro, Necessidade de Caixa, **Projeção 90 dias** (média móvel + recorrências detectadas).
- **Dashboard**: entradas/saídas diário e mensal (Area/Bar), saldo acumulado (LineChart), calendário financeiro (heatmap simples), gráfico de tendência.
- **IA Fluxo**: prevê mês com falta de caixa, saldo projetado, capacidade de investimento/distribuição.

### 3. Ponto de Equilíbrio (`/markup/financial-intelligence/break-even`)

- Busca **Custos Fixos** (categorias fixas em `custos`), **Variáveis**, **Margem de Contribuição** e **Markup médio** (de `markup_calculations`).
- Calcula 3 pontos de equilíbrio (contábil, financeiro, econômico), receita mínima, dias para atingir, margem de segurança, GAO.
- **Simulador**: sliders/inputs para preço (+%), custos (−%), vendas (+%), funcionários, impostos. Tudo recalculado em tempo real **client-side** (não grava no banco).
- Comparação cenário atual vs simulado (dual bar).
- **IA Break-Even**: responde "qual ação gera maior impacto".

### 4. CEO Financial Cockpit (`/markup/financial-intelligence` — index)

- **Cards executivos**: Receita, Lucro, EBITDA, Caixa, Margem, Markup Médio, Break-Even, Capital de Giro, Liquidez, Rentabilidade, Endividamento, ROI, ROE, CMV, Margem de Contribuição, Receita-alvo, Projeção próximo mês. Cada card: cor (verde/amarelo/vermelho), seta de tendência, vs mês anterior, meta (de `kpis`/`business_plans`), % evolução.
- **Radar Executivo**: IA classifica automaticamente alertas (custos crescendo, receita caindo, fluxo negativo, fornecedor caro, produto sem lucro, etc.) em 🟢🟡🔴 com descrição, motivo, impacto estimado em R$, prioridade, recomendação, botão "Ver Detalhes" → navega para o registro relacionado (rota da Central de Custos com filtro).
- **Simulador Estratégico** (drawer): altera Receita, Custos, Impostos, Preço, Markup, Margem, Volume, Colaboradores, Investimentos. Mostra impacto imediato em DRE, DFC, EBITDA, Lucro Líquido, Break-Even, Capital de Giro, Caixa Projetado, Margens, Rentabilidade. Botão "Salvar Cenário" (opcional — só grava se clicar; usa nova tabela `financial_scenarios`).

### IA Financial Advisor

- `financial-ai.functions.ts` usa Gemini 3 Flash via Lovable AI Gateway.
- **Antes de chamar IA**: monta `executiveSummary` (apenas agregados — receita, despesas por categoria top 10, margens, EBITDA, caixa, BE, tendências, variações MoM/YoY). Nunca envia linhas brutas.
- Saída estruturada JSON: `{ diagnostico, evidencias[], impactoFinanceiroEstimado, recomendacoes[] }`.
- Compartilhado pelas 4 telas (mesma server fn com `mode: 'dre'|'dfc'|'break-even'|'cockpit'`).

### Banco

Apenas **uma tabela nova** (cenários salvos opcionais):

```
financial_scenarios(id, user_id, empresa_id?, nome, payload jsonb, created_at, updated_at)
```

RLS por `user_id`, GRANTs padrão. Nenhuma outra alteração de schema — todo cálculo lê das tabelas existentes.

### Integração com Fase 1 (Executive Share)

Todas as 4 telas usam o componente `<ExecutiveShare>` no header (WhatsApp/PDF/Excel/CSV/PNG), com payload contendo KPIs + tabela DRE/DFC/BE conforme a tela.

### Detalhes técnicos

- **Sem duplicidade**: nenhum input manual de custo/receita. Apenas leitura. Simulador é state local.
- **Performance**: cálculos memoizados (`useMemo`), server fns retornam dados pré-agregados por mês/categoria.
- **Stack**: TanStack Start, recharts (já no projeto), shadcn, Tailwind v4 tokens semânticos.
- **Navegação**: subnav sticky no topo do submódulo com 4 abas (Cockpit / DRE / DFC / Break-Even).

### Entregáveis

1. 1 migration: `financial_scenarios` + RLS + GRANTs.
2. 5 arquivos de rota (layout + 4 telas).
3. 3 arquivos lib (núcleo + 2 server fns).
4. Atualização do `app-shell.tsx` (item de menu).
5. Atalho na página `/markup` para abrir o novo submódulo.
