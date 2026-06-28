-- PX Core: audit log + ativo columns for registry clientes

CREATE TABLE IF NOT EXISTS public.px_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','inactivate','reactivate','duplicate','delete')),
  diff jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.px_audit_log TO authenticated;
GRANT ALL ON public.px_audit_log TO service_role;

ALTER TABLE public.px_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_authenticated" ON public.px_audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_insert_authenticated" ON public.px_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS px_audit_log_entity_idx ON public.px_audit_log(entity_type, entity_id, created_at DESC);

-- Active/inactive flags on registry clientes
ALTER TABLE public.px_registry_clientes
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS inativado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_inativacao text;
