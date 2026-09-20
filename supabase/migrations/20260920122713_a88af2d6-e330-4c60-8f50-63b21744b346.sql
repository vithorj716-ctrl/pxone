
-- ============================================================
-- PXSales — auditoria corretiva estrutural
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- 1. Helpers de permissão / empresa ----------
CREATE OR REPLACE FUNCTION public.px_has_permission(_user_id uuid, _sistema text, _acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_executive(_user_id)
     OR EXISTS (
       SELECT 1
       FROM public.px_usuario_perfis up
       JOIN public.px_perfil_permissoes pp ON pp.perfil_id = up.perfil_id
       WHERE up.user_id = _user_id
         AND pp.sistema_key = _sistema
         AND pp.acao = _acao
     );
$$;

CREATE OR REPLACE FUNCTION public.px_user_empresas(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id FROM public.empresas e WHERE public.is_executive(_user_id)
  UNION
  SELECT m.empresa_id FROM public.px_usuarios_meta m
   WHERE m.user_id = _user_id AND m.empresa_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.px_can_access_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _empresa_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.px_user_empresas(_user_id) x WHERE x = _empresa_id);
$$;

-- gate único do PXSales: sistema + permissão + empresa
CREATE OR REPLACE FUNCTION public.pxsales_can(_acao text, _empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.has_system_access(auth.uid(), 'pxsales')
     AND public.px_has_permission(auth.uid(), 'pxsales', _acao)
     AND public.px_can_access_empresa(auth.uid(), _empresa_id);
$$;

GRANT EXECUTE ON FUNCTION public.px_has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.px_user_empresas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.px_can_access_empresa(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pxsales_can(text, uuid) TO authenticated, service_role;

-- ---------- 2. empresa_id em todas as tabelas comerciais ----------
ALTER TABLE public.pxsales_leads          ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_oportunidades  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_atividades     ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_cotacoes       ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_propostas      ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_comissao_regras ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);
ALTER TABLE public.pxsales_comissoes      ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL REFERENCES public.empresas(id);

CREATE INDEX IF NOT EXISTS idx_pxsales_leads_empresa ON public.pxsales_leads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_oport_empresa ON public.pxsales_oportunidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_ativ_empresa ON public.pxsales_atividades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_cot_empresa ON public.pxsales_cotacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_prop_empresa ON public.pxsales_propostas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_regras_empresa ON public.pxsales_comissao_regras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pxsales_comis_empresa ON public.pxsales_comissoes(empresa_id);

-- ---------- 3. Comissões: regras mais completas e sem ambiguidade ----------
ALTER TABLE public.pxsales_comissao_regras
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_operacao text;

ALTER TABLE public.pxsales_comissao_regras DROP CONSTRAINT IF EXISTS pxsales_regra_base_chk;
ALTER TABLE public.pxsales_comissao_regras ADD CONSTRAINT pxsales_regra_base_chk
  CHECK (base IN ('proposta','faturamento','margem'));
ALTER TABLE public.pxsales_comissao_regras DROP CONSTRAINT IF EXISTS pxsales_regra_tipo_chk;
ALTER TABLE public.pxsales_comissao_regras ADD CONSTRAINT pxsales_regra_tipo_chk
  CHECK (tipo IN ('percentual','fixo'));
ALTER TABLE public.pxsales_comissao_regras DROP CONSTRAINT IF EXISTS pxsales_regra_valores_chk;
ALTER TABLE public.pxsales_comissao_regras ADD CONSTRAINT pxsales_regra_valores_chk
  CHECK (percentual >= 0 AND percentual <= 100 AND valor_fixo >= 0);
ALTER TABLE public.pxsales_comissao_regras DROP CONSTRAINT IF EXISTS pxsales_regra_vigencia_chk;
ALTER TABLE public.pxsales_comissao_regras ADD CONSTRAINT pxsales_regra_vigencia_chk
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio);

ALTER TABLE public.pxsales_comissao_regras DROP CONSTRAINT IF EXISTS pxsales_regra_sem_sobreposicao;
ALTER TABLE public.pxsales_comissao_regras ADD CONSTRAINT pxsales_regra_sem_sobreposicao
  EXCLUDE USING gist (
    empresa_id WITH =,
    COALESCE(responsavel_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(cliente_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(tipo_operacao, '*') WITH =,
    daterange(vigencia_inicio, COALESCE(vigencia_fim, 'infinity'::date), '[]') WITH &&
  ) WHERE (ativo);

-- ---------- 4. Comissões: rastreabilidade e estorno ----------
ALTER TABLE public.pxsales_comissoes
  ADD COLUMN IF NOT EXISTS base text NOT NULL DEFAULT 'proposta',
  ADD COLUMN IF NOT EXISTS valor_fixo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regra_nome text,
  ADD COLUMN IF NOT EXISTS regra_vigencia_inicio date,
  ADD COLUMN IF NOT EXISTS regra_vigencia_fim date,
  ADD COLUMN IF NOT EXISTS apurada_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS estornada_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_por uuid,
  ADD COLUMN IF NOT EXISTS estorno_motivo text,
  ADD COLUMN IF NOT EXISTS comissao_origem_id uuid REFERENCES public.pxsales_comissoes(id) ON DELETE SET NULL;

ALTER TABLE public.pxsales_comissoes DROP CONSTRAINT IF EXISTS pxsales_comissoes_status_chk;
ALTER TABLE public.pxsales_comissoes ADD CONSTRAINT pxsales_comissoes_status_chk
  CHECK (status IN ('prevista','aprovada','paga','cancelada','estornada'));
ALTER TABLE public.pxsales_comissoes DROP CONSTRAINT IF EXISTS pxsales_comissoes_valores_chk;
ALTER TABLE public.pxsales_comissoes ADD CONSTRAINT pxsales_comissoes_valores_chk
  CHECK (base_valor >= 0 AND percentual >= 0 AND percentual <= 100 AND valor >= 0 AND valor_fixo >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pxsales_comissao_proposta
  ON public.pxsales_comissoes(proposta_id) WHERE proposta_id IS NOT NULL AND comissao_origem_id IS NULL;

-- ---------- 5. Controle de abuso nos canais públicos ----------
CREATE TABLE IF NOT EXISTS public.pxsales_public_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo text NOT NULL,
  chave text NOT NULL,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pxsales_public_acessos TO service_role;
ALTER TABLE public.pxsales_public_acessos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pxsales_public_acessos_exec" ON public.pxsales_public_acessos;
CREATE POLICY "pxsales_public_acessos_exec" ON public.pxsales_public_acessos
  FOR SELECT TO authenticated USING (public.is_executive(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS uq_pxsales_public_acessos ON public.pxsales_public_acessos(escopo, chave);

CREATE OR REPLACE FUNCTION public.pxsales_rate_limit(p_escopo text, p_chave text, p_max integer, p_janela_seg integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tentativas integer;
BEGIN
  INSERT INTO public.pxsales_public_acessos (escopo, chave, janela_inicio, tentativas)
  VALUES (p_escopo, COALESCE(NULLIF(p_chave, ''), 'anon'), now(), 1)
  ON CONFLICT (escopo, chave) DO UPDATE
    SET tentativas = CASE
          WHEN public.pxsales_public_acessos.janela_inicio < now() - make_interval(secs => p_janela_seg) THEN 1
          ELSE public.pxsales_public_acessos.tentativas + 1 END,
        janela_inicio = CASE
          WHEN public.pxsales_public_acessos.janela_inicio < now() - make_interval(secs => p_janela_seg) THEN now()
          ELSE public.pxsales_public_acessos.janela_inicio END
  RETURNING tentativas INTO v_tentativas;
  RETURN v_tentativas <= p_max;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pxsales_rate_limit(text, text, integer, integer) TO service_role, authenticated;

-- ---------- 6. RPC: apuração de comissão (atômica e determinística) ----------
CREATE OR REPLACE FUNCTION public.pxsales_apurar_comissao(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record; r record; v_base numeric := 0; v_valor numeric := 0; v_id uuid; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO p FROM public.pxsales_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
  IF NOT public.pxsales_can('pxsales.comissoes.manage', p.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para apurar comissões desta empresa.';
  END IF;
  IF p.status <> 'aceita' THEN RAISE EXCEPTION 'A comissão só é apurada depois da proposta aceita.'; END IF;
  IF p.responsavel_id IS NULL THEN RAISE EXCEPTION 'A proposta não tem responsável comercial.'; END IF;

  IF EXISTS (SELECT 1 FROM public.pxsales_comissoes c
              WHERE c.proposta_id = p.id AND c.comissao_origem_id IS NULL) THEN
    SELECT id INTO v_id FROM public.pxsales_comissoes WHERE proposta_id = p.id AND comissao_origem_id IS NULL;
    RETURN jsonb_build_object('id', v_id, 'ja_existia', true);
  END IF;

  SELECT * INTO r FROM public.pxsales_comissao_regras g
   WHERE g.ativo
     AND g.empresa_id = p.empresa_id
     AND g.vigencia_inicio <= COALESCE(p.aceita_em::date, CURRENT_DATE)
     AND (g.vigencia_fim IS NULL OR g.vigencia_fim >= COALESCE(p.aceita_em::date, CURRENT_DATE))
     AND (g.responsavel_id IS NULL OR g.responsavel_id = p.responsavel_id)
     AND (g.cliente_id IS NULL OR g.cliente_id = p.cliente_id)
   ORDER BY (g.cliente_id IS NOT NULL) DESC,
            (g.responsavel_id IS NOT NULL) DESC,
            (g.tipo_operacao IS NOT NULL) DESC,
            g.vigencia_inicio DESC
   LIMIT 1;
  IF r IS NULL THEN RAISE EXCEPTION 'Nenhuma regra de comissão vigente para esta proposta.'; END IF;

  IF r.base = 'proposta' THEN
    v_base := COALESCE(p.valor_total, 0);
  ELSIF r.base = 'faturamento' THEN
    SELECT COALESCE(SUM(m.valor_frete), 0) INTO v_base
      FROM public.tms_minutas m WHERE m.id = p.minuta_id AND m.cancelada_em IS NULL;
    IF v_base = 0 THEN RAISE EXCEPTION 'Sem faturamento na operação para apurar esta comissão.'; END IF;
  ELSE
    RAISE EXCEPTION 'Base "margem" ainda não é suportada: não há custo operacional registrado.';
  END IF;

  v_valor := CASE WHEN r.tipo = 'fixo' THEN r.valor_fixo ELSE ROUND(v_base * r.percentual / 100.0, 2) END;

  INSERT INTO public.pxsales_comissoes (
    empresa_id, proposta_id, cliente_id, empresa_nome, responsavel_id, regra_id, regra_snapshot,
    regra_nome, regra_vigencia_inicio, regra_vigencia_fim, base, base_valor, percentual, valor_fixo,
    valor, competencia, status, congelada_em, apurada_em, created_by
  ) VALUES (
    p.empresa_id, p.id, p.cliente_id, p.empresa_nome, p.responsavel_id, r.id, to_jsonb(r),
    r.nome, r.vigencia_inicio, r.vigencia_fim, r.base, v_base,
    CASE WHEN r.tipo = 'fixo' THEN 0 ELSE r.percentual END,
    CASE WHEN r.tipo = 'fixo' THEN r.valor_fixo ELSE 0 END,
    v_valor, date_trunc('month', COALESCE(p.aceita_em, now()))::date, 'prevista', now(), now(), v_uid
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.pxsales_comissoes WHERE proposta_id = p.id AND comissao_origem_id IS NULL;
    RETURN jsonb_build_object('id', v_id, 'ja_existia', true);
  END IF;

  INSERT INTO public.px_audit_log (entity_type, entity_id, action, diff, user_id)
  VALUES ('pxsales_comissoes', v_id, 'apurada',
          jsonb_build_object('proposta_id', p.id, 'regra_id', r.id, 'base', r.base, 'valor', v_valor), v_uid);

  RETURN jsonb_build_object('id', v_id, 'ja_existia', false, 'valor', v_valor);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pxsales_apurar_comissao(uuid) TO authenticated, service_role;

-- ---------- 7. RPC: transição de status da comissão ----------
CREATE OR REPLACE FUNCTION public.pxsales_set_status_comissao(p_id uuid, p_status text, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_uid uuid := auth.uid(); v_ok boolean; v_estorno uuid;
BEGIN
  SELECT * INTO c FROM public.pxsales_comissoes WHERE id = p_id FOR UPDATE;
  IF c IS NULL THEN RAISE EXCEPTION 'Comissão não encontrada.'; END IF;
  IF NOT public.pxsales_can('pxsales.comissoes.manage', c.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar comissões desta empresa.';
  END IF;

  v_ok := CASE
    WHEN c.status = 'prevista' AND p_status IN ('aprovada','cancelada') THEN true
    WHEN c.status = 'aprovada' AND p_status IN ('paga','cancelada') THEN true
    WHEN c.status = 'paga' AND p_status = 'estornada' THEN true
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transição inválida: % → %.', c.status, p_status; END IF;
  IF p_status IN ('cancelada','estornada') AND COALESCE(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo.';
  END IF;

  IF p_status = 'estornada' THEN
    UPDATE public.pxsales_comissoes
       SET status = 'estornada', estornada_em = now(), estornada_por = v_uid,
           estorno_motivo = p_motivo, updated_by = v_uid
     WHERE id = c.id;
    INSERT INTO public.pxsales_comissoes (
      empresa_id, proposta_id, cliente_id, empresa_nome, responsavel_id, regra_id, regra_snapshot,
      regra_nome, regra_vigencia_inicio, regra_vigencia_fim, base, base_valor, percentual, valor_fixo,
      valor, competencia, status, congelada_em, apurada_em, comissao_origem_id, observacoes, created_by
    ) VALUES (
      c.empresa_id, c.proposta_id, c.cliente_id, c.empresa_nome, c.responsavel_id, c.regra_id, c.regra_snapshot,
      c.regra_nome, c.regra_vigencia_inicio, c.regra_vigencia_fim, c.base, c.base_valor, c.percentual, c.valor_fixo,
      c.valor, c.competencia, 'estornada', now(), now(), c.id, 'Estorno: ' || p_motivo, v_uid
    ) RETURNING id INTO v_estorno;
  ELSE
    UPDATE public.pxsales_comissoes
       SET status = p_status, observacoes = COALESCE(p_motivo, observacoes), updated_by = v_uid
     WHERE id = c.id;
  END IF;

  INSERT INTO public.px_audit_log (entity_type, entity_id, action, diff, user_id)
  VALUES ('pxsales_comissoes', c.id, 'status',
          jsonb_build_object('de', c.status, 'para', p_status, 'motivo', p_motivo), v_uid);

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'estorno_id', v_estorno);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pxsales_set_status_comissao(uuid, text, text) TO authenticated, service_role;

-- ---------- 8. RPC: resposta do cliente no portal (atômica) ----------
CREATE OR REPLACE FUNCTION public.pxsales_responder_proposta_publica(
  p_token text, p_acao text, p_mensagem text DEFAULT NULL, p_nome text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_status text; v_msg text := NULLIF(left(COALESCE(p_mensagem,''), 1000), '');
        v_quem text := NULLIF(left(COALESCE(p_nome,''), 120), '');
BEGIN
  IF p_acao NOT IN ('aceitar','recusar','alteracao') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;

  SELECT * INTO p FROM public.pxsales_propostas
   WHERE portal_token = p_token FOR UPDATE;
  IF p IS NULL OR p.portal_ativo IS FALSE THEN RAISE EXCEPTION 'Este link não está mais disponível.'; END IF;
  IF p.portal_expira_em IS NOT NULL AND p.portal_expira_em < now() THEN
    RAISE EXCEPTION 'Este link expirou. Fale com seu contato comercial.';
  END IF;
  IF p.status IN ('aceita','recusada') THEN RAISE EXCEPTION 'Esta proposta já foi respondida.'; END IF;

  v_status := CASE p_acao WHEN 'aceitar' THEN 'aceita' WHEN 'recusar' THEN 'recusada' ELSE 'em_negociacao' END;

  UPDATE public.pxsales_propostas
     SET status = v_status,
         motivo = v_msg,
         aceita_em = CASE WHEN v_status = 'aceita' THEN now() ELSE aceita_em END,
         recusada_em = CASE WHEN v_status = 'recusada' THEN now() ELSE recusada_em END
   WHERE id = p.id;

  INSERT INTO public.pxsales_proposta_historico (proposta_id, status_anterior, status_novo, observacao)
  VALUES (p.id, p.status, v_status,
          'Portal do cliente' || COALESCE(' — ' || v_quem, '') || COALESCE(': ' || v_msg, ''));

  INSERT INTO public.pxsales_portal_eventos (proposta_id, tipo, mensagem, payload)
  VALUES (p.id, p_acao, v_msg, jsonb_build_object('nome', v_quem));

  INSERT INTO public.px_audit_log (entity_type, entity_id, action, diff, user_label)
  VALUES ('pxsales_propostas', p.id, 'portal_' || p_acao,
          jsonb_build_object('de', p.status, 'para', v_status), COALESCE(v_quem, 'Portal do cliente'));

  RETURN jsonb_build_object('status', v_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pxsales_responder_proposta_publica(text, text, text, text) TO service_role;

-- ---------- 9. RPC: conversão proposta → PXLog (transacional) ----------
CREATE OR REPLACE FUNCTION public.pxsales_converter_proposta_pxlog(p_proposta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; c record; reg record; v_tms uuid; v_min record; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO p FROM public.pxsales_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF p IS NULL THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
  IF NOT public.pxsales_can('pxsales.propostas.create', p.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para enviar propostas desta empresa para a operação.';
  END IF;
  IF p.minuta_id IS NOT NULL THEN RAISE EXCEPTION 'Esta proposta já gerou um embarque no PXLog.'; END IF;
  IF p.status <> 'aceita' THEN RAISE EXCEPTION 'Só é possível enviar para a operação depois que a proposta for aceita.'; END IF;
  IF p.cotacao_id IS NULL THEN RAISE EXCEPTION 'A proposta não tem cotação vinculada.'; END IF;

  SELECT * INTO c FROM public.pxsales_cotacoes WHERE id = p.cotacao_id;
  IF c IS NULL THEN RAISE EXCEPTION 'Cotação da proposta não encontrada.'; END IF;

  IF p.cliente_id IS NOT NULL THEN
    SELECT id INTO v_tms FROM public.tms_clientes WHERE registry_id = p.cliente_id LIMIT 1;
    IF v_tms IS NULL THEN
      SELECT * INTO reg FROM public.px_registry_clientes WHERE id = p.cliente_id;
      IF reg IS NOT NULL THEN
        INSERT INTO public.tms_clientes (empresa_id, registry_id, nome, cnpj, cidade, uf, email, telefone)
        VALUES (p.empresa_id, reg.id, COALESCE(reg.nome_fantasia, reg.razao_social), reg.cnpj,
                reg.cidade, reg.uf, reg.email, reg.telefone)
        RETURNING id INTO v_tms;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.tms_minutas (
    empresa_id, cliente_id, remetente, destinatario, origem, destino, qtd_volumes, peso, cubagem,
    peso_cubado, peso_taxado, valor_mercadoria, tipo_mercadoria, valor_frete, prazo_dias,
    status, responsavel_id, observacoes
  ) VALUES (
    p.empresa_id, v_tms,
    jsonb_build_object('nome', c.empresa_nome, 'cidade', c.origem_cidade, 'uf', c.origem_uf, 'cep', c.origem_cep),
    jsonb_build_object('nome', 'A confirmar', 'cidade', c.destino_cidade, 'uf', c.destino_uf, 'cep', c.destino_cep),
    COALESCE(NULLIF(concat_ws('/', c.origem_cidade, c.origem_uf), ''), 'Origem a definir'),
    COALESCE(NULLIF(concat_ws('/', c.destino_cidade, c.destino_uf), ''), 'Destino a definir'),
    COALESCE(c.qtd_volumes, 1), COALESCE(c.peso, 0), COALESCE(c.cubagem, 0), COALESCE(c.peso_cubado, 0),
    COALESCE(c.peso_taxado, 0), COALESCE(c.valor_mercadoria, 0), c.tipo_mercadoria,
    COALESCE(p.valor_total, c.valor_total, 0), COALESCE(c.prazo_dias, 1),
    'solicitado', v_uid, 'Origem comercial: proposta PXSales nº ' || p.numero
  ) RETURNING id, numero INTO v_min;

  INSERT INTO public.tms_eventos (minuta_id, tipo, origem_evento, operador_id, payload)
  VALUES (v_min.id, 'solicitado', 'pxsales', v_uid,
          jsonb_build_object('proposta_id', p.id, 'proposta_numero', p.numero));

  UPDATE public.pxsales_propostas SET minuta_id = v_min.id, updated_by = v_uid WHERE id = p.id;

  INSERT INTO public.pxsales_proposta_historico (proposta_id, status_anterior, status_novo, observacao)
  VALUES (p.id, p.status, p.status, 'Embarque nº ' || v_min.numero || ' criado no PXLog');

  INSERT INTO public.px_audit_log (entity_type, entity_id, action, diff, user_id)
  VALUES ('pxsales_propostas', p.id, 'convertida_pxlog',
          jsonb_build_object('minuta_id', v_min.id, 'numero', v_min.numero), v_uid);

  RETURN jsonb_build_object('minuta_id', v_min.id, 'numero', v_min.numero);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pxsales_converter_proposta_pxlog(uuid) TO authenticated, service_role;

-- ---------- 10. RLS reescrita ----------
DO $$
DECLARE t text; pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pxsales_leads','pxsales_oportunidades','pxsales_atividades','pxsales_cotacoes','pxsales_propostas',
    'pxsales_comissao_regras','pxsales_comissoes','pxsales_oportunidade_historico','pxsales_proposta_historico',
    'pxsales_portal_eventos','pxsales_pipeline_etapas'
  ] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Leads
CREATE POLICY "leads_select" ON public.pxsales_leads FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.leads.view', empresa_id));
CREATE POLICY "leads_insert" ON public.pxsales_leads FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.leads.create', empresa_id));
CREATE POLICY "leads_update" ON public.pxsales_leads FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.leads.edit', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.leads.edit', empresa_id));
CREATE POLICY "leads_delete" ON public.pxsales_leads FOR DELETE TO authenticated
  USING (public.pxsales_can('pxsales.leads.edit', empresa_id)
         AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

-- Oportunidades
CREATE POLICY "oport_select" ON public.pxsales_oportunidades FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.oportunidades.view', empresa_id));
CREATE POLICY "oport_insert" ON public.pxsales_oportunidades FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.oportunidades.edit', empresa_id));
CREATE POLICY "oport_update" ON public.pxsales_oportunidades FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.oportunidades.edit', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.oportunidades.edit', empresa_id));
CREATE POLICY "oport_delete" ON public.pxsales_oportunidades FOR DELETE TO authenticated
  USING (public.pxsales_can('pxsales.oportunidades.edit', empresa_id)
         AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

-- Atividades
CREATE POLICY "ativ_select" ON public.pxsales_atividades FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.leads.view', empresa_id));
CREATE POLICY "ativ_insert" ON public.pxsales_atividades FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.leads.edit', empresa_id));
CREATE POLICY "ativ_update" ON public.pxsales_atividades FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.leads.edit', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.leads.edit', empresa_id));
CREATE POLICY "ativ_delete" ON public.pxsales_atividades FOR DELETE TO authenticated
  USING (public.pxsales_can('pxsales.leads.edit', empresa_id)
         AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

-- Cotações
CREATE POLICY "cot_select" ON public.pxsales_cotacoes FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.cotacoes.view', empresa_id));
CREATE POLICY "cot_insert" ON public.pxsales_cotacoes FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.cotacoes.create', empresa_id));
CREATE POLICY "cot_update" ON public.pxsales_cotacoes FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.cotacoes.edit', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.cotacoes.edit', empresa_id));
CREATE POLICY "cot_delete" ON public.pxsales_cotacoes FOR DELETE TO authenticated
  USING (public.pxsales_can('pxsales.cotacoes.edit', empresa_id)
         AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

-- Propostas
CREATE POLICY "prop_select" ON public.pxsales_propostas FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.propostas.view', empresa_id));
CREATE POLICY "prop_insert" ON public.pxsales_propostas FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.propostas.create', empresa_id));
CREATE POLICY "prop_update" ON public.pxsales_propostas FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.propostas.create', empresa_id)
         OR public.pxsales_can('pxsales.portal.manage', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.propostas.create', empresa_id)
         OR public.pxsales_can('pxsales.portal.manage', empresa_id));
CREATE POLICY "prop_delete" ON public.pxsales_propostas FOR DELETE TO authenticated
  USING (public.pxsales_can('pxsales.propostas.create', empresa_id)
         AND (created_by = auth.uid() OR public.is_executive(auth.uid())));

-- Regras de comissão
CREATE POLICY "regra_select" ON public.pxsales_comissao_regras FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.comissoes.view', empresa_id));
CREATE POLICY "regra_write" ON public.pxsales_comissao_regras FOR ALL TO authenticated
  USING (public.pxsales_can('pxsales.comissoes.manage', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.comissoes.manage', empresa_id));

-- Comissões (só leitura direta; escrita via RPC security definer)
CREATE POLICY "comis_select" ON public.pxsales_comissoes FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.comissoes.view', empresa_id)
         AND (responsavel_id = auth.uid()
              OR public.pxsales_can('pxsales.comissoes.manage', empresa_id)));

-- Históricos derivados
CREATE POLICY "op_hist_select" ON public.pxsales_oportunidade_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pxsales_oportunidades o
                  WHERE o.id = oportunidade_id
                    AND public.pxsales_can('pxsales.oportunidades.view', o.empresa_id)));
CREATE POLICY "op_hist_insert" ON public.pxsales_oportunidade_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pxsales_oportunidades o
                  WHERE o.id = oportunidade_id
                    AND public.pxsales_can('pxsales.oportunidades.edit', o.empresa_id)));

CREATE POLICY "prop_hist_select" ON public.pxsales_proposta_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pxsales_propostas p
                  WHERE p.id = proposta_id
                    AND public.pxsales_can('pxsales.propostas.view', p.empresa_id)));
CREATE POLICY "prop_hist_insert" ON public.pxsales_proposta_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pxsales_propostas p
                  WHERE p.id = proposta_id
                    AND public.pxsales_can('pxsales.propostas.create', p.empresa_id)));

CREATE POLICY "portal_ev_select" ON public.pxsales_portal_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pxsales_propostas p
                  WHERE p.id = proposta_id
                    AND public.pxsales_can('pxsales.portal.manage', p.empresa_id)));

-- Etapas do funil (configuração compartilhada)
CREATE POLICY "etapas_select" ON public.pxsales_pipeline_etapas FOR SELECT TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxsales'));
CREATE POLICY "etapas_write" ON public.pxsales_pipeline_etapas FOR ALL TO authenticated
  USING (public.px_has_permission(auth.uid(), 'pxsales', 'pxsales.settings.manage'))
  WITH CHECK (public.px_has_permission(auth.uid(), 'pxsales', 'pxsales.settings.manage'));
