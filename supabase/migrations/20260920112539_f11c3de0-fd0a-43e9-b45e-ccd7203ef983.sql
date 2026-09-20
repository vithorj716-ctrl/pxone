CREATE SEQUENCE IF NOT EXISTS public.pxsales_cotacao_numero_seq;
CREATE SEQUENCE IF NOT EXISTS public.pxsales_proposta_numero_seq;

CREATE TABLE public.pxsales_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.pxsales_cotacao_numero_seq'),
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.pxsales_oportunidades(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.pxsales_leads(id) ON DELETE SET NULL,
  empresa_nome text NOT NULL,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  origem_cidade text,
  origem_uf text,
  origem_cep text,
  destino_cidade text,
  destino_uf text,
  destino_cep text,
  tipo_operacao text NOT NULL DEFAULT 'transferencia',
  tabela_frete_id uuid REFERENCES public.tms_tabela_frete(id) ON DELETE SET NULL,
  tabela_frete_nome text,
  qtd_volumes integer NOT NULL DEFAULT 1,
  peso numeric NOT NULL DEFAULT 0,
  cubagem numeric NOT NULL DEFAULT 0,
  peso_cubado numeric NOT NULL DEFAULT 0,
  peso_taxado numeric NOT NULL DEFAULT 0,
  valor_mercadoria numeric NOT NULL DEFAULT 0,
  tipo_mercadoria text,
  prazo_dias integer NOT NULL DEFAULT 1,
  valor_base numeric NOT NULL DEFAULT 0,
  valor_coleta numeric NOT NULL DEFAULT 0,
  valor_entrega numeric NOT NULL DEFAULT 0,
  pedagio numeric NOT NULL DEFAULT 0,
  gris_percentual numeric NOT NULL DEFAULT 0,
  advalorem_percentual numeric NOT NULL DEFAULT 0,
  taxas_extras numeric NOT NULL DEFAULT 0,
  desconto_percentual numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  frequencia_mensal integer,
  condicao_pagamento text,
  validade_ate date,
  status text NOT NULL DEFAULT 'rascunho',
  observacoes text,
  responsavel_id uuid,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pxsales_cotacoes_cliente_idx ON public.pxsales_cotacoes (cliente_id);
CREATE INDEX pxsales_cotacoes_status_idx ON public.pxsales_cotacoes (status);
CREATE INDEX pxsales_cotacoes_oportunidade_idx ON public.pxsales_cotacoes (oportunidade_id);

CREATE TABLE public.pxsales_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.pxsales_proposta_numero_seq'),
  cotacao_id uuid REFERENCES public.pxsales_cotacoes(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.pxsales_oportunidades(id) ON DELETE SET NULL,
  empresa_nome text NOT NULL,
  titulo text NOT NULL,
  escopo text,
  condicoes text,
  condicao_pagamento text,
  validade_ate date,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho',
  enviada_em timestamptz,
  visualizada_em timestamptz,
  aceita_em timestamptz,
  recusada_em timestamptz,
  motivo text,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsavel_id uuid,
  minuta_id uuid REFERENCES public.tms_minutas(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pxsales_propostas_cliente_idx ON public.pxsales_propostas (cliente_id);
CREATE INDEX pxsales_propostas_status_idx ON public.pxsales_propostas (status);
CREATE INDEX pxsales_propostas_cotacao_idx ON public.pxsales_propostas (cotacao_id);

CREATE TABLE public.pxsales_proposta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.pxsales_propostas(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pxsales_proposta_historico_idx ON public.pxsales_proposta_historico (proposta_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_cotacoes TO authenticated;
GRANT ALL ON public.pxsales_cotacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_propostas TO authenticated;
GRANT ALL ON public.pxsales_propostas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_proposta_historico TO authenticated;
GRANT ALL ON public.pxsales_proposta_historico TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pxsales_cotacao_numero_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pxsales_proposta_numero_seq TO authenticated, service_role;

ALTER TABLE public.pxsales_cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_proposta_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pxsales_cotacoes_select" ON public.pxsales_cotacoes FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_cotacoes_insert" ON public.pxsales_cotacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_cotacoes_update" ON public.pxsales_cotacoes FOR UPDATE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_cotacoes_delete" ON public.pxsales_cotacoes FOR DELETE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales') AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

CREATE POLICY "pxsales_propostas_select" ON public.pxsales_propostas FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_propostas_insert" ON public.pxsales_propostas FOR INSERT TO authenticated
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_propostas_update" ON public.pxsales_propostas FOR UPDATE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_propostas_delete" ON public.pxsales_propostas FOR DELETE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales') AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

CREATE POLICY "pxsales_prop_hist_select" ON public.pxsales_proposta_historico FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_prop_hist_insert" ON public.pxsales_proposta_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_prop_hist_update" ON public.pxsales_proposta_historico FOR UPDATE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales_prop_hist_delete" ON public.pxsales_proposta_historico FOR DELETE TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales') AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

CREATE TRIGGER set_pxsales_cotacoes_updated_at BEFORE UPDATE ON public.pxsales_cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_propostas_updated_at BEFORE UPDATE ON public.pxsales_propostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();