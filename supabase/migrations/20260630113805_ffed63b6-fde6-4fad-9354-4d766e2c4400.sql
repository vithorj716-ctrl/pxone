
-- =====================================================================
-- PX API — Fundação (Fase 1)
-- =====================================================================

-- 1) Sistemas consumidores da PX API
CREATE TABLE public.px_api_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sistema_key TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  api_key_prefix TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  escopos TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_rpm INTEGER NOT NULL DEFAULT 120,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_api_clients TO authenticated;
GRANT ALL ON public.px_api_clients TO service_role;

ALTER TABLE public.px_api_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos gerenciam api_clients"
  ON public.px_api_clients FOR ALL
  TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE TRIGGER trg_px_api_clients_updated
  BEFORE UPDATE ON public.px_api_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_px_api_clients_sistema_key ON public.px_api_clients(sistema_key);
CREATE INDEX idx_px_api_clients_ativo ON public.px_api_clients(ativo);

-- 2) Tokens emitidos (para revogação e refresh)
CREATE TABLE public.px_api_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_client_id UUID NOT NULL REFERENCES public.px_api_clients(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT,
  escopos TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revogado BOOLEAN NOT NULL DEFAULT FALSE,
  revogado_em TIMESTAMPTZ,
  revogado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.px_api_tokens TO authenticated;
GRANT ALL ON public.px_api_tokens TO service_role;

ALTER TABLE public.px_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos veem tokens"
  ON public.px_api_tokens FOR SELECT
  TO authenticated
  USING (public.is_executive(auth.uid()));

CREATE POLICY "Executivos revogam tokens"
  ON public.px_api_tokens FOR UPDATE
  TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE TRIGGER trg_px_api_tokens_updated
  BEFORE UPDATE ON public.px_api_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_px_api_tokens_client ON public.px_api_tokens(api_client_id);
CREATE INDEX idx_px_api_tokens_jti ON public.px_api_tokens(jti);
CREATE INDEX idx_px_api_tokens_expires ON public.px_api_tokens(expires_at);

-- 3) Logs de auditoria da API
CREATE TABLE public.px_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_client_id UUID REFERENCES public.px_api_clients(id) ON DELETE SET NULL,
  sistema_key TEXT,
  user_id UUID,
  request_id TEXT,
  metodo TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status INTEGER NOT NULL,
  latencia_ms INTEGER,
  ip TEXT,
  user_agent TEXT,
  erro_codigo TEXT,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.px_api_logs TO authenticated;
GRANT ALL ON public.px_api_logs TO service_role;

ALTER TABLE public.px_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos leem logs"
  ON public.px_api_logs FOR SELECT
  TO authenticated
  USING (public.is_executive(auth.uid()));

CREATE INDEX idx_px_api_logs_client ON public.px_api_logs(api_client_id);
CREATE INDEX idx_px_api_logs_sistema ON public.px_api_logs(sistema_key);
CREATE INDEX idx_px_api_logs_created ON public.px_api_logs(created_at DESC);
CREATE INDEX idx_px_api_logs_endpoint ON public.px_api_logs(endpoint);
CREATE INDEX idx_px_api_logs_status ON public.px_api_logs(status);

-- Comentários
COMMENT ON TABLE public.px_api_clients IS 'Sistemas consumidores da PX API (PXLog, PXComercial, etc).';
COMMENT ON TABLE public.px_api_tokens IS 'Tokens JWT emitidos para sistemas consumidores — usado para revogação e refresh.';
COMMENT ON TABLE public.px_api_logs IS 'Auditoria de toda requisição à PX API.';
