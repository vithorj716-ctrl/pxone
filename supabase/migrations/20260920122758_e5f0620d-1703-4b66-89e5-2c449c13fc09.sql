
REVOKE ALL ON FUNCTION public.px_has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.px_user_empresas(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.px_can_access_empresa(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pxsales_can(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pxsales_rate_limit(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pxsales_apurar_comissao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pxsales_set_status_comissao(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pxsales_responder_proposta_publica(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pxsales_converter_proposta_pxlog(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_system_access(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.px_has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.px_user_empresas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.px_can_access_empresa(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_can(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_rate_limit(text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_apurar_comissao(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_set_status_comissao(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_responder_proposta_publica(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_converter_proposta_pxlog(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_system_access(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "px_api_idempotency_exec" ON public.px_api_idempotency;
CREATE POLICY "px_api_idempotency_exec" ON public.px_api_idempotency
  FOR SELECT TO authenticated USING (public.is_executive(auth.uid()));
