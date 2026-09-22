ALTER TABLE public.pxsales_leads
  ADD COLUMN IF NOT EXISTS captura_key text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE UNIQUE INDEX IF NOT EXISTS pxsales_leads_captura_key_uidx
  ON public.pxsales_leads (empresa_id, captura_key)
  WHERE captura_key IS NOT NULL;