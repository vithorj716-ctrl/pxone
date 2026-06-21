
-- Enum tipo de custo
CREATE TYPE public.tipo_custo AS ENUM ('fixo','variavel','unico','recorrente');

-- Categorias configuráveis
CREATE TABLE public.categorias_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_custo TO authenticated;
GRANT ALL ON public.categorias_custo TO service_role;

ALTER TABLE public.categorias_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias readable" ON public.categorias_custo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create categorias" ON public.categorias_custo
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Executives manage categorias" ON public.categorias_custo
  FOR ALL TO authenticated USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

-- Custos
CREATE TABLE public.custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  centro_custo text,
  categoria_id uuid REFERENCES public.categorias_custo(id) ON DELETE SET NULL,
  tipo_custo public.tipo_custo NOT NULL DEFAULT 'unico',
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custos TO authenticated;
GRANT ALL ON public.custos TO service_role;

ALTER TABLE public.custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Custos readable" ON public.custos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert custos" ON public.custos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner update custos" ON public.custos
  FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner delete custos" ON public.custos
  FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Executives manage custos" ON public.custos
  FOR ALL TO authenticated USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_custos_updated_at
  BEFORE UPDATE ON public.custos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Categorias iniciais
INSERT INTO public.categorias_custo (nome) VALUES
  ('Operacional'),('Administrativo'),('Comercial'),('Marketing'),
  ('Pessoal'),('Tecnologia'),('Financeiro'),('Investimento');
