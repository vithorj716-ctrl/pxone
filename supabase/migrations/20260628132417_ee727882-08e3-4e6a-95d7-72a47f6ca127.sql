
-- ============ px_cliente_credito ============
CREATE TABLE public.px_cliente_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  limite_credito numeric(14,2) NOT NULL DEFAULT 0,
  dia_fechamento smallint,
  dia_vencimento smallint,
  prazo_dias int NOT NULL DEFAULT 0,
  bloqueado boolean NOT NULL DEFAULT false,
  motivo_bloqueio text,
  liberado_por uuid,
  liberado_ate timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_cliente_credito TO authenticated;
GRANT ALL ON public.px_cliente_credito TO service_role;
ALTER TABLE public.px_cliente_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read credito" ON public.px_cliente_credito FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write credito" ON public.px_cliente_credito FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update credito" ON public.px_cliente_credito FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete credito" ON public.px_cliente_credito FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_credito_updated BEFORE UPDATE ON public.px_cliente_credito FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_credito_cliente ON public.px_cliente_credito(cliente_id);

-- ============ px_cliente_lancamentos ============
CREATE TABLE public.px_cliente_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('debito','credito')),
  origem text NOT NULL CHECK (origem IN ('minuta','pagamento','ajuste','estorno','manual')),
  referencia_id uuid,
  referencia_tipo text,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  emissao date NOT NULL DEFAULT CURRENT_DATE,
  vencimento date,
  pago_em date,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago','vencido','cancelado')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_cliente_lancamentos TO authenticated;
GRANT ALL ON public.px_cliente_lancamentos TO service_role;
ALTER TABLE public.px_cliente_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read lanc" ON public.px_cliente_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write lanc" ON public.px_cliente_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update lanc" ON public.px_cliente_lancamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete lanc" ON public.px_cliente_lancamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.px_cliente_lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lanc_cliente ON public.px_cliente_lancamentos(cliente_id);
CREATE INDEX idx_lanc_status ON public.px_cliente_lancamentos(status);
CREATE INDEX idx_lanc_venc ON public.px_cliente_lancamentos(vencimento);

-- ============ view saldo ============
CREATE OR REPLACE VIEW public.px_cliente_saldo AS
SELECT
  c.id AS cliente_id,
  COALESCE(cr.limite_credito, 0) AS limite_credito,
  COALESCE(cr.bloqueado, false) AS bloqueado,
  cr.motivo_bloqueio,
  cr.liberado_ate,
  COALESCE(SUM(CASE WHEN l.status = 'aberto' AND l.tipo='debito' THEN l.valor ELSE 0 END), 0) AS utilizado,
  COALESCE(SUM(CASE WHEN l.status IN ('aberto','vencido') AND l.tipo='debito' AND l.vencimento < CURRENT_DATE THEN l.valor ELSE 0 END), 0) AS vencido,
  GREATEST(COALESCE(cr.limite_credito,0) - COALESCE(SUM(CASE WHEN l.status='aberto' AND l.tipo='debito' THEN l.valor ELSE 0 END),0), 0) AS disponivel
FROM public.px_registry_clientes c
LEFT JOIN public.px_cliente_credito cr ON cr.cliente_id = c.id
LEFT JOIN public.px_cliente_lancamentos l ON l.cliente_id = c.id
GROUP BY c.id, cr.limite_credito, cr.bloqueado, cr.motivo_bloqueio, cr.liberado_ate;

GRANT SELECT ON public.px_cliente_saldo TO authenticated;
GRANT SELECT ON public.px_cliente_saldo TO service_role;
