
DROP POLICY IF EXISTS "Authenticated create categorias" ON public.categorias_custo;
CREATE POLICY "Authenticated create categorias" ON public.categorias_custo
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
