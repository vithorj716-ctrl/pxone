CREATE TABLE public.px_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  origem text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.px_events TO authenticated;
GRANT ALL ON public.px_events TO service_role;
ALTER TABLE public.px_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read px_events" ON public.px_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert px_events" ON public.px_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX px_events_tipo_idx ON public.px_events (tipo, created_at DESC);

CREATE TABLE public.px_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  modelo text NOT NULL,
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.px_ai_usage TO authenticated;
GRANT ALL ON public.px_ai_usage TO service_role;
ALTER TABLE public.px_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read px_ai_usage" ON public.px_ai_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert px_ai_usage" ON public.px_ai_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX px_ai_usage_modulo_idx ON public.px_ai_usage (modulo, created_at DESC);