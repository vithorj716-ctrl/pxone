
-- PX Integration: vínculos lógicos entre sistemas + inbox de eventos recebidos.
-- Sem duplicar dados de domínio. Apenas referências e auditoria.

CREATE TABLE public.px_integration_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sistema_origem text NOT NULL,         -- 'pxone' | 'pxcrm' | 'pxlog'
  tipo_origem text NOT NULL,            -- 'operacao' | 'cotacao' | 'cliente' | 'lancamento' | ...
  id_origem text NOT NULL,
  sistema_destino text NOT NULL,
  tipo_destino text NOT NULL,
  id_destino text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sistema_origem, tipo_origem, id_origem, sistema_destino, tipo_destino, id_destino)
);

CREATE INDEX idx_pxil_origem ON public.px_integration_links (sistema_origem, tipo_origem, id_origem);
CREATE INDEX idx_pxil_destino ON public.px_integration_links (sistema_destino, tipo_destino, id_destino);

GRANT ALL ON public.px_integration_links TO service_role;
GRANT SELECT ON public.px_integration_links TO authenticated;

ALTER TABLE public.px_integration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos podem ler vínculos"
ON public.px_integration_links FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

CREATE TRIGGER trg_pxil_updated_at
BEFORE UPDATE ON public.px_integration_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.px_integration_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sistema_origem text NOT NULL,
  evento text NOT NULL,                 -- 'faturamento.criado', 'cliente.atualizado', etc.
  external_id text,                     -- id idempotência fornecido pelo emissor
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'recebido', -- 'recebido' | 'processado' | 'erro'
  erro text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sistema_origem, evento, external_id)
);

CREATE INDEX idx_pxii_status ON public.px_integration_inbox (status, created_at DESC);

GRANT ALL ON public.px_integration_inbox TO service_role;
GRANT SELECT ON public.px_integration_inbox TO authenticated;

ALTER TABLE public.px_integration_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executivos podem ler inbox"
ON public.px_integration_inbox FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));
