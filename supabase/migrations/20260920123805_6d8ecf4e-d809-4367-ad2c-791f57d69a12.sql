
ALTER TABLE public.px_perfil_permissoes DROP CONSTRAINT IF EXISTS px_perfil_permissoes_acao_check;
ALTER TABLE public.px_perfil_permissoes ADD CONSTRAINT px_perfil_permissoes_acao_check
  CHECK (
    acao = ANY (ARRAY['view','create','edit','delete','export','approve'])
    OR acao ~ '^[a-z0-9_-]+\.[a-z0-9_.]+$'
  );
