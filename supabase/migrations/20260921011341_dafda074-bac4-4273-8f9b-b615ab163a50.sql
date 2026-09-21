REVOKE EXECUTE ON FUNCTION public.financeiro_can(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_touch_updated_at() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.financeiro_can(text, uuid) TO authenticated, service_role;