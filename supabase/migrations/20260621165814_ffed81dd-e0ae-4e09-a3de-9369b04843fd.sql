
-- Perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles
CREATE TYPE public.app_role AS ENUM ('master_admin','socio','diretor','gestor','consultor','auditor');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_executive(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('master_admin','socio','diretor')
  )
$$;

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Empresas
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  setor TEXT,
  cor_tema TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas readable" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Executives manage empresas" ON public.empresas FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

INSERT INTO public.empresas (codigo, nome, setor, cor_tema) VALUES
  ('PXLOG','PXLog Logística','Logística e Transporte','#10b981'),
  ('PXMED','PXMed Serviços Médicos','Saúde','#3b82f6'),
  ('PXFARMA','PXFarma Distribuidora','Farmacêutica','#a855f7');

-- KPI snapshots mensais
CREATE TABLE public.kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  periodo DATE NOT NULL,
  receita NUMERIC(18,2) DEFAULT 0,
  ebitda NUMERIC(18,2) DEFAULT 0,
  lucro_liquido NUMERIC(18,2) DEFAULT 0,
  caixa NUMERIC(18,2) DEFAULT 0,
  capital_giro NUMERIC(18,2) DEFAULT 0,
  contas_pagar NUMERIC(18,2) DEFAULT 0,
  contas_receber NUMERIC(18,2) DEFAULT 0,
  endividamento NUMERIC(18,2) DEFAULT 0,
  valuation NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, periodo)
);
GRANT SELECT ON public.kpi_snapshots TO authenticated;
GRANT ALL ON public.kpi_snapshots TO service_role;
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KPI readable" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Executives manage KPIs" ON public.kpi_snapshots FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

-- Business Plans
CREATE TYPE public.plan_horizon AS ENUM ('1_ano','3_anos','5_anos','10_anos');

CREATE TABLE public.business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  horizonte public.plan_horizon NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  meta_receita NUMERIC(18,2) DEFAULT 0,
  meta_ebitda NUMERIC(18,2) DEFAULT 0,
  meta_valuation NUMERIC(18,2) DEFAULT 0,
  progresso INT DEFAULT 0,
  status TEXT DEFAULT 'em_andamento',
  ano_inicio INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_plans TO authenticated;
GRANT ALL ON public.business_plans TO service_role;
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans readable" ON public.business_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Executives manage plans" ON public.business_plans FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));
