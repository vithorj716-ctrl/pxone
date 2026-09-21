-- ============================================================
-- FINANCEIRO PX (sistema_key = 'pxfin') — Fase 1/2 estrutura
-- ============================================================

CREATE OR REPLACE FUNCTION public.financeiro_can(_acao text, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.has_system_access(auth.uid(), 'pxfin')
     AND public.px_has_permission(auth.uid(), 'pxfin', _acao)
     AND public.px_can_access_empresa(auth.uid(), _empresa_id)
$$;

CREATE OR REPLACE FUNCTION public.fin_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- Cadastros ----------
CREATE TABLE public.fin_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'banco' CHECK (tipo IN ('banco','caixa','carteira','outro')),
  banco text, agencia text, conta text,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fin_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  natureza text NOT NULL DEFAULT 'despesa' CHECK (natureza IN ('despesa','receita')),
  parent_id uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome, natureza)
);

CREATE TABLE public.fin_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  codigo text,
  parent_id uuid REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE public.fin_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'colaborador' CHECK (tipo IN ('colaborador','prestador','fornecedor','motorista','parceiro','outro')),
  documento text,
  email text, telefone text,
  chave_pix text,
  banco text, agencia text, conta text,
  cargo text,
  valor_referencia numeric(14,2),
  recorrencia text CHECK (recorrencia IN ('mensal','quinzenal','semanal','avulso')),
  centro_custo_id uuid REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Movimentação ----------
CREATE TABLE public.fin_contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  fornecedor_id uuid REFERENCES public.fin_pessoas(id) ON DELETE SET NULL,
  fornecedor_nome text,
  categoria_id uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  conta_id uuid REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  competencia date,
  vencimento date NOT NULL,
  pago_em date,
  forma_pagamento text,
  origem text NOT NULL DEFAULT 'manual',
  origem_tipo text,
  origem_id uuid,
  documento text,
  observacao text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('previsto','aberto','parcialmente_pago','pago','vencido','cancelado')),
  cancelado_em timestamptz, cancelado_por uuid, cancelamento_motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fin_contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  categoria_id uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  conta_id uuid REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  valor_recebido numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0),
  competencia date,
  vencimento date NOT NULL,
  recebido_em date,
  forma_prevista text,
  origem text NOT NULL DEFAULT 'manual',
  origem_tipo text,
  origem_id uuid,
  documento text,
  observacao text,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('previsto','aberto','parcialmente_recebido','recebido','vencido','cancelado')),
  cancelado_em timestamptz, cancelado_por uuid, cancelamento_motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fin_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('pagamento','recebimento')),
  conta_id uuid REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  conta_pagar_id uuid REFERENCES public.fin_contas_pagar(id) ON DELETE RESTRICT,
  conta_receber_id uuid REFERENCES public.fin_contas_receber(id) ON DELETE RESTRICT,
  adiantamento_id uuid,
  comissao_id uuid REFERENCES public.pxsales_comissoes(id) ON DELETE SET NULL,
  folha_item_id uuid,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL DEFAULT CURRENT_DATE,
  forma text,
  documento text,
  observacao text,
  estornado_em timestamptz, estornado_por uuid, estorno_motivo text,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fin_movimentos_idem_uidx
  ON public.fin_movimentos (empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE public.fin_lancamento_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  acao text NOT NULL,
  de jsonb, para jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Adiantamentos / folha ----------
CREATE TABLE public.fin_adiantamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pessoa_id uuid REFERENCES public.fin_pessoas(id) ON DELETE SET NULL,
  beneficiario_nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'colaborador'
    CHECK (tipo IN ('colaborador','motorista','prestador','parceiro','operacao')),
  valor_solicitado numeric(14,2) NOT NULL CHECK (valor_solicitado > 0),
  valor_aprovado numeric(14,2),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  valor_acertado numeric(14,2) NOT NULL DEFAULT 0,
  motivo text,
  operacao_tipo text, operacao_id uuid,
  centro_custo_id uuid REFERENCES public.fin_centros_custo(id) ON DELETE SET NULL,
  conta_id uuid REFERENCES public.fin_contas(id) ON DELETE SET NULL,
  forma_pagamento text,
  status text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','aprovado','pago','parcialmente_acertado','acertado','cancelado','estornado')),
  aprovado_por uuid, aprovado_em timestamptz,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_movimentos
  ADD CONSTRAINT fin_movimentos_adiantamento_fk
  FOREIGN KEY (adiantamento_id) REFERENCES public.fin_adiantamentos(id) ON DELETE RESTRICT;

CREATE TABLE public.fin_folha_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  referencia text NOT NULL,
  inicio date NOT NULL,
  fim date NOT NULL,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta','aprovada','paga','cancelada')),
  aprovado_por uuid, aprovado_em timestamptz,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, referencia)
);

CREATE TABLE public.fin_folha_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  periodo_id uuid NOT NULL REFERENCES public.fin_folha_periodos(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.fin_pessoas(id) ON DELETE RESTRICT,
  valor_base numeric(14,2) NOT NULL DEFAULT 0,
  adicionais numeric(14,2) NOT NULL DEFAULT 0,
  descontos numeric(14,2) NOT NULL DEFAULT 0,
  adiantamentos numeric(14,2) NOT NULL DEFAULT 0,
  ajustes numeric(14,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','pago','cancelado')),
  conta_pagar_id uuid REFERENCES public.fin_contas_pagar(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, pessoa_id)
);
ALTER TABLE public.fin_movimentos
  ADD CONSTRAINT fin_movimentos_folha_item_fk
  FOREIGN KEY (folha_item_id) REFERENCES public.fin_folha_itens(id) ON DELETE RESTRICT;

-- ---------- Documentos ----------
CREATE SEQUENCE public.fin_recibos_seq;
CREATE TABLE public.fin_recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero bigint NOT NULL DEFAULT nextval('public.fin_recibos_seq'),
  tipo text NOT NULL DEFAULT 'pagamento'
    CHECK (tipo IN ('pagamento','adiantamento','prestacao_servico','comissao','acerto','outro')),
  beneficiario_nome text NOT NULL,
  beneficiario_documento text,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text,
  origem_tipo text, origem_id uuid,
  movimento_id uuid REFERENCES public.fin_movimentos(id) ON DELETE SET NULL,
  via integer NOT NULL DEFAULT 1,
  reemissao_de uuid REFERENCES public.fin_recibos(id) ON DELETE SET NULL,
  cancelado_em timestamptz, cancelado_por uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);

CREATE TABLE public.fin_conciliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_id uuid NOT NULL REFERENCES public.fin_contas(id) ON DELETE RESTRICT,
  data date NOT NULL,
  valor numeric(14,2) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  descricao text,
  origem text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'nao_conciliado'
    CHECK (status IN ('nao_conciliado','conciliado','divergente','ignorado')),
  movimento_id uuid REFERENCES public.fin_movimentos(id) ON DELETE SET NULL,
  conciliado_por uuid, conciliado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fin_faturamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  origem_tipo text NOT NULL DEFAULT 'minuta',
  origem_id uuid,
  origem_numero text,
  proposta_id uuid REFERENCES public.pxsales_propostas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  competencia date,
  emissao date NOT NULL DEFAULT CURRENT_DATE,
  vencimento date,
  documento text,
  conta_receber_id uuid REFERENCES public.fin_contas_receber(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'faturado'
    CHECK (status IN ('elegivel','faturado','cancelado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fin_faturamentos_origem_uidx
  ON public.fin_faturamentos (empresa_id, origem_tipo, origem_id)
  WHERE origem_id IS NOT NULL AND status <> 'cancelado';

-- ---------- Índices ----------
CREATE INDEX fin_contas_empresa_idx ON public.fin_contas (empresa_id);
CREATE INDEX fin_categorias_empresa_idx ON public.fin_categorias (empresa_id);
CREATE INDEX fin_centros_empresa_idx ON public.fin_centros_custo (empresa_id);
CREATE INDEX fin_pessoas_empresa_idx ON public.fin_pessoas (empresa_id, tipo);
CREATE INDEX fin_cp_empresa_idx ON public.fin_contas_pagar (empresa_id, status, vencimento);
CREATE INDEX fin_cr_empresa_idx ON public.fin_contas_receber (empresa_id, status, vencimento);
CREATE INDEX fin_cr_cliente_idx ON public.fin_contas_receber (cliente_id);
CREATE INDEX fin_mov_empresa_idx ON public.fin_movimentos (empresa_id, tipo, data);
CREATE INDEX fin_hist_entidade_idx ON public.fin_lancamento_historico (entidade, entidade_id);
CREATE INDEX fin_adto_empresa_idx ON public.fin_adiantamentos (empresa_id, status);
CREATE INDEX fin_folha_itens_periodo_idx ON public.fin_folha_itens (periodo_id);
CREATE INDEX fin_recibos_empresa_idx ON public.fin_recibos (empresa_id, data);
CREATE INDEX fin_conc_empresa_idx ON public.fin_conciliacao (empresa_id, status, data);
CREATE INDEX fin_fat_empresa_idx ON public.fin_faturamentos (empresa_id, status, emissao);

-- ---------- Triggers updated_at ----------
CREATE TRIGGER t_fin_contas BEFORE UPDATE ON public.fin_contas FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_categorias BEFORE UPDATE ON public.fin_categorias FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_centros BEFORE UPDATE ON public.fin_centros_custo FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_pessoas BEFORE UPDATE ON public.fin_pessoas FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_cp BEFORE UPDATE ON public.fin_contas_pagar FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_cr BEFORE UPDATE ON public.fin_contas_receber FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_adto BEFORE UPDATE ON public.fin_adiantamentos FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_folha_per BEFORE UPDATE ON public.fin_folha_periodos FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_folha_it BEFORE UPDATE ON public.fin_folha_itens FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_conc BEFORE UPDATE ON public.fin_conciliacao FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER t_fin_fat BEFORE UPDATE ON public.fin_faturamentos FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

-- ---------- GRANTs ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_contas, public.fin_categorias, public.fin_centros_custo,
  public.fin_pessoas, public.fin_contas_pagar, public.fin_contas_receber, public.fin_movimentos,
  public.fin_lancamento_historico, public.fin_adiantamentos, public.fin_folha_periodos, public.fin_folha_itens,
  public.fin_recibos, public.fin_conciliacao, public.fin_faturamentos TO authenticated;
GRANT ALL ON public.fin_contas, public.fin_categorias, public.fin_centros_custo,
  public.fin_pessoas, public.fin_contas_pagar, public.fin_contas_receber, public.fin_movimentos,
  public.fin_lancamento_historico, public.fin_adiantamentos, public.fin_folha_periodos, public.fin_folha_itens,
  public.fin_recibos, public.fin_conciliacao, public.fin_faturamentos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fin_recibos_seq TO authenticated, service_role;

-- ---------- RLS ----------
ALTER TABLE public.fin_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_lancamento_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_folha_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_folha_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_conciliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_faturamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY fin_contas_rw ON public.fin_contas FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.view', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.settings.manage', empresa_id));
CREATE POLICY fin_categorias_rw ON public.fin_categorias FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.view', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.settings.manage', empresa_id));
CREATE POLICY fin_centros_rw ON public.fin_centros_custo FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.view', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.settings.manage', empresa_id));
CREATE POLICY fin_pessoas_r ON public.fin_pessoas FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.colaboradores.view', empresa_id));
CREATE POLICY fin_pessoas_w ON public.fin_pessoas FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.colaboradores.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.colaboradores.manage', empresa_id));
CREATE POLICY fin_cp_r ON public.fin_contas_pagar FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.contas_pagar.view', empresa_id));
CREATE POLICY fin_cp_w ON public.fin_contas_pagar FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.contas_pagar.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.contas_pagar.manage', empresa_id));
CREATE POLICY fin_cr_r ON public.fin_contas_receber FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.contas_receber.view', empresa_id));
CREATE POLICY fin_cr_w ON public.fin_contas_receber FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.contas_receber.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.contas_receber.manage', empresa_id));
CREATE POLICY fin_mov_r ON public.fin_movimentos FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.view', empresa_id));
CREATE POLICY fin_hist_r ON public.fin_lancamento_historico FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.view', empresa_id));
CREATE POLICY fin_adto_r ON public.fin_adiantamentos FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.adiantamentos.view', empresa_id));
CREATE POLICY fin_adto_w ON public.fin_adiantamentos FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.adiantamentos.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.adiantamentos.manage', empresa_id));
CREATE POLICY fin_folha_per_r ON public.fin_folha_periodos FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.folha.view', empresa_id));
CREATE POLICY fin_folha_per_w ON public.fin_folha_periodos FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.folha.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.folha.manage', empresa_id));
CREATE POLICY fin_folha_it_r ON public.fin_folha_itens FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.folha.view', empresa_id));
CREATE POLICY fin_folha_it_w ON public.fin_folha_itens FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.folha.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.folha.manage', empresa_id));
CREATE POLICY fin_recibos_r ON public.fin_recibos FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.recibos.view', empresa_id));
CREATE POLICY fin_conc_r ON public.fin_conciliacao FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.conciliacao.view', empresa_id));
CREATE POLICY fin_conc_w ON public.fin_conciliacao FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.conciliacao.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.conciliacao.manage', empresa_id));
CREATE POLICY fin_fat_r ON public.fin_faturamentos FOR SELECT TO authenticated
  USING (public.financeiro_can('financeiro.faturamento.view', empresa_id));
CREATE POLICY fin_fat_w ON public.fin_faturamentos FOR ALL TO authenticated
  USING (public.financeiro_can('financeiro.faturamento.manage', empresa_id))
  WITH CHECK (public.financeiro_can('financeiro.faturamento.manage', empresa_id));
