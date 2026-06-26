
CREATE TABLE public.markup_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  produto text NOT NULL,
  servico text,
  categoria text,
  centro_custo text,
  fornecedor text,
  descricao text,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultados jsonb NOT NULL DEFAULT '{}'::jsonb,
  lucro_desejado numeric,
  margem_desejada numeric,
  preco_sugerido numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.markup_calculations TO authenticated;
GRANT ALL ON public.markup_calculations TO service_role;

ALTER TABLE public.markup_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage markup calculations"
  ON public.markup_calculations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_markup_calc_updated
  BEFORE UPDATE ON public.markup_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_markup_calc_empresa ON public.markup_calculations(empresa_id);
CREATE INDEX idx_markup_calc_user ON public.markup_calculations(user_id);
CREATE INDEX idx_markup_calc_created ON public.markup_calculations(created_at DESC);
