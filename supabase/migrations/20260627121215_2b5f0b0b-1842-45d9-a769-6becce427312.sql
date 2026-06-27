
-- Enriquecimento da tabela empresas (todas colunas opcionais)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS cor_secundaria text,
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Filiais
CREATE TABLE IF NOT EXISTS public.px_filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cidade text,
  uf text,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_filiais TO authenticated;
GRANT ALL ON public.px_filiais TO service_role;
ALTER TABLE public.px_filiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "px_filiais_auth_all" ON public.px_filiais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER px_filiais_updated BEFORE UPDATE ON public.px_filiais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Empresa x Módulo
CREATE TABLE IF NOT EXISTS public.px_empresa_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo_key text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  habilitado_em timestamptz NOT NULL DEFAULT now(),
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, modulo_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_empresa_modulos TO authenticated;
GRANT ALL ON public.px_empresa_modulos TO service_role;
ALTER TABLE public.px_empresa_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "px_empresa_modulos_auth_all" ON public.px_empresa_modulos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER px_empresa_modulos_updated BEFORE UPDATE ON public.px_empresa_modulos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Compartilhamento opcional de recursos
CREATE TABLE IF NOT EXISTS public.px_shared_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  recurso_id uuid NOT NULL,
  empresa_origem_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empresas_compartilhadas uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_shared_resources TO authenticated;
GRANT ALL ON public.px_shared_resources TO service_role;
ALTER TABLE public.px_shared_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "px_shared_resources_auth_all" ON public.px_shared_resources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER px_shared_resources_updated BEFORE UPDATE ON public.px_shared_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
