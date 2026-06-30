CREATE TABLE public.px_api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id uuid NOT NULL REFERENCES public.px_api_clients(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (api_client_id, idempotency_key, endpoint, method)
);

GRANT ALL ON public.px_api_idempotency TO service_role;

ALTER TABLE public.px_api_idempotency ENABLE ROW LEVEL SECURITY;

-- Sem políticas: somente service_role (que ignora RLS) pode acessar.

CREATE INDEX idx_px_api_idempotency_lookup
  ON public.px_api_idempotency (api_client_id, idempotency_key);

CREATE INDEX idx_px_api_idempotency_expires
  ON public.px_api_idempotency (expires_at);