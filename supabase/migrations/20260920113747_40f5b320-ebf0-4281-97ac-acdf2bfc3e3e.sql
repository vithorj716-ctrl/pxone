ALTER TABLE public.pxsales_propostas
  ADD COLUMN IF NOT EXISTS portal_token text,
  ADD COLUMN IF NOT EXISTS portal_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS portal_aberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS portal_ativo boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS pxsales_propostas_portal_token_uq ON public.pxsales_propostas(portal_token) WHERE portal_token IS NOT NULL;

CREATE TABLE public.pxsales_portal_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.pxsales_propostas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  mensagem text,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pxsales_portal_eventos_proposta_idx ON public.pxsales_portal_eventos(proposta_id, created_at DESC);
GRANT SELECT ON public.pxsales_portal_eventos TO authenticated;
GRANT ALL ON public.pxsales_portal_eventos TO service_role;
ALTER TABLE public.pxsales_portal_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pxsales le eventos do portal" ON public.pxsales_portal_eventos
  FOR SELECT TO authenticated USING (public.has_system_access(auth.uid(), 'pxsales'));

CREATE TABLE public.pxsales_comissao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  base text NOT NULL DEFAULT 'proposta',
  tipo text NOT NULL DEFAULT 'percentual',
  percentual numeric NOT NULL DEFAULT 0,
  valor_fixo numeric NOT NULL DEFAULT 0,
  responsavel_id uuid,
  vigencia_inicio date NOT NULL DEFAULT current_date,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pxsales_comissao_regras_resp_idx ON public.pxsales_comissao_regras(responsavel_id, ativo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_comissao_regras TO authenticated;
GRANT ALL ON public.pxsales_comissao_regras TO service_role;
ALTER TABLE public.pxsales_comissao_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pxsales le regras" ON public.pxsales_comissao_regras
  FOR SELECT TO authenticated USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales cria regras" ON public.pxsales_comissao_regras
  FOR INSERT TO authenticated WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales edita regras" ON public.pxsales_comissao_regras
  FOR UPDATE TO authenticated USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales exclui regras" ON public.pxsales_comissao_regras
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_executive(auth.uid()));
CREATE TRIGGER trg_pxsales_comissao_regras_upd BEFORE UPDATE ON public.pxsales_comissao_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pxsales_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES public.pxsales_propostas(id) ON DELETE SET NULL,
  cliente_id uuid,
  empresa_nome text NOT NULL DEFAULT '',
  responsavel_id uuid,
  regra_id uuid REFERENCES public.pxsales_comissao_regras(id) ON DELETE SET NULL,
  regra_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_valor numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  competencia date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'prevista',
  observacoes text,
  congelada_em timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pxsales_comissoes_proposta_uq ON public.pxsales_comissoes(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX pxsales_comissoes_resp_idx ON public.pxsales_comissoes(responsavel_id, competencia DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_comissoes TO authenticated;
GRANT ALL ON public.pxsales_comissoes TO service_role;
ALTER TABLE public.pxsales_comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pxsales le comissoes" ON public.pxsales_comissoes
  FOR SELECT TO authenticated USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales cria comissoes" ON public.pxsales_comissoes
  FOR INSERT TO authenticated WITH CHECK (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales edita comissoes" ON public.pxsales_comissoes
  FOR UPDATE TO authenticated USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "pxsales exclui comissoes" ON public.pxsales_comissoes
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_executive(auth.uid()));
CREATE TRIGGER trg_pxsales_comissoes_upd BEFORE UPDATE ON public.pxsales_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();