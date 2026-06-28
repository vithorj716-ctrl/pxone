
DROP VIEW IF EXISTS public.px_cliente_saldo;
CREATE VIEW public.px_cliente_saldo
WITH (security_invoker = true) AS
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
