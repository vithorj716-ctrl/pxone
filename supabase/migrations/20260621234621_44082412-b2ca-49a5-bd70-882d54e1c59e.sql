
-- Relax empresas to allow authenticated users full CRUD (universal management)
DROP POLICY IF EXISTS "Executives manage empresas" ON public.empresas;
CREATE POLICY "Authenticated manage empresas" ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VALUATION MODELS
CREATE TABLE public.valuation_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  metodologia text NOT NULL,
  ebitda numeric DEFAULT 0,
  multiplo numeric DEFAULT 0,
  wacc numeric DEFAULT 0,
  fcf_anual numeric DEFAULT 0,
  crescimento_perpetuo numeric DEFAULT 0,
  valor_calculado numeric DEFAULT 0,
  premissas text,
  ano_base int,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuation_models TO authenticated;
GRANT ALL ON public.valuation_models TO service_role;
ALTER TABLE public.valuation_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all valuation" ON public.valuation_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_valuation_upd BEFORE UPDATE ON public.valuation_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- KPIs
CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo text,
  valor numeric DEFAULT 0,
  meta numeric DEFAULT 0,
  unidade text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT ALL ON public.kpis TO service_role;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all kpis" ON public.kpis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_kpis_upd BEFORE UPDATE ON public.kpis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYBACK PROJECTS
CREATE TABLE public.payback_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  investimento_inicial numeric DEFAULT 0,
  retorno_mensal numeric DEFAULT 0,
  prazo_meses int DEFAULT 0,
  taxa_desconto numeric DEFAULT 0,
  status text DEFAULT 'analise',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payback_projects TO authenticated;
GRANT ALL ON public.payback_projects TO service_role;
ALTER TABLE public.payback_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all payback" ON public.payback_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_payback_upd BEFORE UPDATE ON public.payback_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RISKS
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  categoria text,
  probabilidade int DEFAULT 1,
  impacto int DEFAULT 1,
  status text DEFAULT 'aberto',
  mitigacao text,
  responsavel text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risks TO authenticated;
GRANT ALL ON public.risks TO service_role;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all risks" ON public.risks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_risks_upd BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DECISIONS
CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  status text DEFAULT 'pendente',
  responsavel text,
  data_decisao date,
  impacto_financeiro numeric DEFAULT 0,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all decisions" ON public.decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_decisions_upd BEFORE UPDATE ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OKRs
CREATE TABLE public.okrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo text NOT NULL,
  descricao text,
  trimestre text,
  responsavel text,
  progresso int DEFAULT 0,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.okrs TO authenticated;
GRANT ALL ON public.okrs TO service_role;
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all okrs" ON public.okrs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_okrs_upd BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid REFERENCES public.okrs(id) ON DELETE CASCADE NOT NULL,
  descricao text NOT NULL,
  meta numeric DEFAULT 0,
  atual numeric DEFAULT 0,
  unidade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.key_results TO authenticated;
GRANT ALL ON public.key_results TO service_role;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all kr" ON public.key_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_kr_upd BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GROWTH
CREATE TABLE public.growth_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo text,
  status text DEFAULT 'planejada',
  investimento numeric DEFAULT 0,
  retorno_projetado numeric DEFAULT 0,
  prazo_meses int DEFAULT 0,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_initiatives TO authenticated;
GRANT ALL ON public.growth_initiatives TO service_role;
ALTER TABLE public.growth_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all growth" ON public.growth_initiatives FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_growth_upd BEFORE UPDATE ON public.growth_initiatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVESTOR UPDATES
CREATE TABLE public.investor_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text,
  periodo text,
  autor text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_updates TO authenticated;
GRANT ALL ON public.investor_updates TO service_role;
ALTER TABLE public.investor_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all investor" ON public.investor_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_investor_upd BEFORE UPDATE ON public.investor_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DOCUMENTS (metadata + url)
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text,
  url text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all docs" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_docs_upd BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TIMELINE
CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL,
  tipo text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all timeline" ON public.timeline_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_timeline_upd BEFORE UPDATE ON public.timeline_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
