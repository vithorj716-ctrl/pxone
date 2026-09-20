
-- PXSales Etapa 3 — Leads, oportunidades, funil e atividades

CREATE TABLE IF NOT EXISTS public.pxsales_pipeline_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  label text NOT NULL,
  cor text NOT NULL DEFAULT '#64748b',
  ordem integer NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'aberta',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.pxsales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text,
  empresa text NOT NULL,
  nome_fantasia text,
  cidade text,
  uf text,
  segmento text,
  origem text NOT NULL DEFAULT 'prospeccao',
  contato_nome text,
  contato_cargo text,
  contato_telefone text,
  contato_email text,
  potencial_mensal numeric(14,2),
  tipo_carga text,
  temperatura text NOT NULL DEFAULT 'morno',
  etapa text NOT NULL DEFAULT 'novo_lead',
  status text NOT NULL DEFAULT 'aberto',
  responsavel_id uuid,
  proxima_acao text,
  proxima_acao_em timestamptz,
  motivo_perda text,
  observacoes text,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  convertido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.pxsales_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.pxsales_leads(id) ON DELETE SET NULL,
  empresa_nome text,
  etapa text NOT NULL DEFAULT 'qualificacao',
  status text NOT NULL DEFAULT 'aberta',
  valor_estimado numeric(14,2) NOT NULL DEFAULT 0,
  frequencia_mensal integer,
  margem_percentual numeric(6,2),
  probabilidade integer NOT NULL DEFAULT 50,
  previsao_fechamento date,
  tipo_operacao text,
  origem text,
  responsavel_id uuid,
  motivo_perda text,
  observacoes text,
  fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.pxsales_oportunidade_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id uuid NOT NULL REFERENCES public.pxsales_oportunidades(id) ON DELETE CASCADE,
  etapa_anterior text,
  etapa_nova text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.pxsales_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'tarefa',
  assunto text NOT NULL,
  descricao text,
  lead_id uuid REFERENCES public.pxsales_leads(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES public.pxsales_oportunidades(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  responsavel_id uuid,
  prevista_para timestamptz,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  resultado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS pxsales_leads_etapa_idx ON public.pxsales_leads(etapa);
CREATE INDEX IF NOT EXISTS pxsales_leads_resp_idx ON public.pxsales_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS pxsales_leads_cnpj_idx ON public.pxsales_leads(cnpj);
CREATE INDEX IF NOT EXISTS pxsales_op_etapa_idx ON public.pxsales_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS pxsales_op_cliente_idx ON public.pxsales_oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS pxsales_op_resp_idx ON public.pxsales_oportunidades(responsavel_id);
CREATE INDEX IF NOT EXISTS pxsales_op_hist_idx ON public.pxsales_oportunidade_historico(oportunidade_id);
CREATE INDEX IF NOT EXISTS pxsales_ativ_lead_idx ON public.pxsales_atividades(lead_id);
CREATE INDEX IF NOT EXISTS pxsales_ativ_op_idx ON public.pxsales_atividades(oportunidade_id);
CREATE INDEX IF NOT EXISTS pxsales_ativ_prev_idx ON public.pxsales_atividades(prevista_para);

CREATE TRIGGER set_pxsales_pipeline_etapas_updated_at BEFORE UPDATE ON public.pxsales_pipeline_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_leads_updated_at BEFORE UPDATE ON public.pxsales_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_oportunidades_updated_at BEFORE UPDATE ON public.pxsales_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_atividades_updated_at BEFORE UPDATE ON public.pxsales_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_pipeline_etapas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_oportunidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_oportunidade_historico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_atividades TO authenticated;
GRANT ALL ON public.pxsales_pipeline_etapas TO service_role;
GRANT ALL ON public.pxsales_leads TO service_role;
GRANT ALL ON public.pxsales_oportunidades TO service_role;
GRANT ALL ON public.pxsales_oportunidade_historico TO service_role;
GRANT ALL ON public.pxsales_atividades TO service_role;

ALTER TABLE public.pxsales_pipeline_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_oportunidade_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_atividades ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pxsales_pipeline_etapas','pxsales_leads','pxsales_oportunidades','pxsales_oportunidade_historico','pxsales_atividades']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_system_access(auth.uid(), ''pxsales''))', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_system_access(auth.uid(), ''pxsales''))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_system_access(auth.uid(), ''pxsales'')) WITH CHECK (public.has_system_access(auth.uid(), ''pxsales''))', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_system_access(auth.uid(), ''pxsales'') AND (created_by = auth.uid() OR public.is_executive(auth.uid())))', t||'_delete', t);
  END LOOP;
END $$;

INSERT INTO public.pxsales_pipeline_etapas (chave, label, cor, ordem, tipo)
VALUES
  ('novo_lead','Novo Lead','#64748b',1,'aberta'),
  ('qualificacao','Qualificação','#0ea5e9',2,'aberta'),
  ('contato','Contato','#6366f1',3,'aberta'),
  ('cotacao','Cotação','#a855f7',4,'aberta'),
  ('proposta_enviada','Proposta Enviada','#f59e0b',5,'aberta'),
  ('negociacao','Negociação','#f97316',6,'aberta'),
  ('ganho','Ganho','#10b981',7,'ganho'),
  ('perdido','Perdido','#ef4444',8,'perdido')
ON CONFLICT (chave) DO NOTHING;
