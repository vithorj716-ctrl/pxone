-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.fin_hist(_empresa uuid, _entidade text, _id uuid, _acao text, _de jsonb, _para jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.fin_lancamento_historico (empresa_id, entidade, entidade_id, acao, de, para, user_id)
  VALUES (_empresa, _entidade, _id, _acao, _de, _para, auth.uid());
$$;

-- ===== Pagamento =====
CREATE OR REPLACE FUNCTION public.fin_registrar_pagamento(
  _conta_pagar_id uuid, _valor numeric, _data date DEFAULT CURRENT_DATE,
  _conta_id uuid DEFAULT NULL, _forma text DEFAULT NULL, _documento text DEFAULT NULL,
  _observacao text DEFAULT NULL, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.fin_contas_pagar; mov_id uuid; novo_pago numeric; novo_status text; existente uuid;
BEGIN
  SELECT * INTO t FROM public.fin_contas_pagar WHERE id = _conta_pagar_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Título não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.pagamentos.manage', t.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para registrar pagamentos nesta empresa.'; END IF;
  IF t.status IN ('pago','cancelado') THEN RAISE EXCEPTION 'Título % não aceita novo pagamento.', t.status; END IF;
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero.'; END IF;
  IF _valor > (t.valor - t.valor_pago) + 0.005 THEN RAISE EXCEPTION 'Valor maior que o saldo em aberto do título.'; END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO existente FROM public.fin_movimentos
      WHERE empresa_id = t.empresa_id AND idempotency_key = _idempotency_key;
    IF existente IS NOT NULL THEN RETURN jsonb_build_object('movimento_id', existente, 'repetido', true); END IF;
  END IF;

  INSERT INTO public.fin_movimentos (empresa_id, tipo, conta_id, conta_pagar_id, valor, data, forma, documento, observacao, idempotency_key, created_by)
  VALUES (t.empresa_id, 'pagamento', COALESCE(_conta_id, t.conta_id), t.id, _valor, COALESCE(_data, CURRENT_DATE), _forma, _documento, _observacao, _idempotency_key, auth.uid())
  RETURNING id INTO mov_id;

  novo_pago := t.valor_pago + _valor;
  novo_status := CASE WHEN novo_pago >= t.valor - 0.005 THEN 'pago' ELSE 'parcialmente_pago' END;
  UPDATE public.fin_contas_pagar
     SET valor_pago = novo_pago, status = novo_status,
         pago_em = CASE WHEN novo_status = 'pago' THEN COALESCE(_data, CURRENT_DATE) ELSE pago_em END,
         conta_id = COALESCE(_conta_id, conta_id), forma_pagamento = COALESCE(_forma, forma_pagamento)
   WHERE id = t.id;

  PERFORM public.fin_hist(t.empresa_id, 'conta_pagar', t.id, 'pagamento',
    jsonb_build_object('status', t.status, 'valor_pago', t.valor_pago),
    jsonb_build_object('status', novo_status, 'valor_pago', novo_pago, 'movimento_id', mov_id));
  RETURN jsonb_build_object('movimento_id', mov_id, 'status', novo_status, 'valor_pago', novo_pago);
END; $$;

-- ===== Recebimento =====
CREATE OR REPLACE FUNCTION public.fin_registrar_recebimento(
  _conta_receber_id uuid, _valor numeric, _data date DEFAULT CURRENT_DATE,
  _conta_id uuid DEFAULT NULL, _forma text DEFAULT NULL, _documento text DEFAULT NULL,
  _observacao text DEFAULT NULL, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.fin_contas_receber; mov_id uuid; novo numeric; novo_status text; existente uuid;
BEGIN
  SELECT * INTO t FROM public.fin_contas_receber WHERE id = _conta_receber_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Título não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.recebimentos.manage', t.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para registrar recebimentos nesta empresa.'; END IF;
  IF t.status IN ('recebido','cancelado') THEN RAISE EXCEPTION 'Título % não aceita novo recebimento.', t.status; END IF;
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor do recebimento deve ser maior que zero.'; END IF;
  IF _valor > (t.valor - t.valor_recebido) + 0.005 THEN RAISE EXCEPTION 'Valor maior que o saldo em aberto do título.'; END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO existente FROM public.fin_movimentos
      WHERE empresa_id = t.empresa_id AND idempotency_key = _idempotency_key;
    IF existente IS NOT NULL THEN RETURN jsonb_build_object('movimento_id', existente, 'repetido', true); END IF;
  END IF;

  INSERT INTO public.fin_movimentos (empresa_id, tipo, conta_id, conta_receber_id, valor, data, forma, documento, observacao, idempotency_key, created_by)
  VALUES (t.empresa_id, 'recebimento', COALESCE(_conta_id, t.conta_id), t.id, _valor, COALESCE(_data, CURRENT_DATE), _forma, _documento, _observacao, _idempotency_key, auth.uid())
  RETURNING id INTO mov_id;

  novo := t.valor_recebido + _valor;
  novo_status := CASE WHEN novo >= t.valor - 0.005 THEN 'recebido' ELSE 'parcialmente_recebido' END;
  UPDATE public.fin_contas_receber
     SET valor_recebido = novo, status = novo_status,
         recebido_em = CASE WHEN novo_status = 'recebido' THEN COALESCE(_data, CURRENT_DATE) ELSE recebido_em END,
         conta_id = COALESCE(_conta_id, conta_id)
   WHERE id = t.id;

  PERFORM public.fin_hist(t.empresa_id, 'conta_receber', t.id, 'recebimento',
    jsonb_build_object('status', t.status, 'valor_recebido', t.valor_recebido),
    jsonb_build_object('status', novo_status, 'valor_recebido', novo, 'movimento_id', mov_id));
  RETURN jsonb_build_object('movimento_id', mov_id, 'status', novo_status, 'valor_recebido', novo);
END; $$;

-- ===== Cancelar título =====
CREATE OR REPLACE FUNCTION public.fin_cancelar_titulo(_entidade text, _id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp uuid; st text;
BEGIN
  IF _entidade = 'conta_pagar' THEN
    SELECT empresa_id, status INTO emp, st FROM public.fin_contas_pagar WHERE id = _id FOR UPDATE;
    IF emp IS NULL THEN RAISE EXCEPTION 'Título não encontrado.'; END IF;
    IF NOT public.financeiro_can('financeiro.contas_pagar.manage', emp) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
    IF st = 'pago' THEN RAISE EXCEPTION 'Título pago não pode ser cancelado; use estorno.'; END IF;
    UPDATE public.fin_contas_pagar SET status='cancelado', cancelado_em=now(), cancelado_por=auth.uid(), cancelamento_motivo=_motivo WHERE id=_id;
  ELSIF _entidade = 'conta_receber' THEN
    SELECT empresa_id, status INTO emp, st FROM public.fin_contas_receber WHERE id = _id FOR UPDATE;
    IF emp IS NULL THEN RAISE EXCEPTION 'Título não encontrado.'; END IF;
    IF NOT public.financeiro_can('financeiro.contas_receber.manage', emp) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
    IF st = 'recebido' THEN RAISE EXCEPTION 'Título recebido não pode ser cancelado; use estorno.'; END IF;
    UPDATE public.fin_contas_receber SET status='cancelado', cancelado_em=now(), cancelado_por=auth.uid(), cancelamento_motivo=_motivo WHERE id=_id;
  ELSE RAISE EXCEPTION 'Entidade inválida.'; END IF;
  PERFORM public.fin_hist(emp, _entidade, _id, 'cancelamento', jsonb_build_object('status', st), jsonb_build_object('status','cancelado','motivo',_motivo));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ===== Estorno de movimento =====
CREATE OR REPLACE FUNCTION public.fin_estornar_movimento(_movimento_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.fin_movimentos; novo numeric; novo_status text;
BEGIN
  SELECT * INTO m FROM public.fin_movimentos WHERE id = _movimento_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Movimento não encontrado.'; END IF;
  IF m.estornado_em IS NOT NULL THEN RAISE EXCEPTION 'Movimento já estornado.'; END IF;
  IF NOT public.financeiro_can(
      CASE WHEN m.tipo='pagamento' THEN 'financeiro.pagamentos.manage' ELSE 'financeiro.recebimentos.manage' END,
      m.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para estornar.'; END IF;

  UPDATE public.fin_movimentos SET estornado_em=now(), estornado_por=auth.uid(), estorno_motivo=_motivo WHERE id=m.id;

  IF m.conta_pagar_id IS NOT NULL THEN
    UPDATE public.fin_contas_pagar SET valor_pago = GREATEST(valor_pago - m.valor, 0) WHERE id = m.conta_pagar_id
      RETURNING valor_pago INTO novo;
    SELECT CASE WHEN novo <= 0.005 THEN 'aberto' WHEN novo >= valor - 0.005 THEN 'pago' ELSE 'parcialmente_pago' END
      INTO novo_status FROM public.fin_contas_pagar WHERE id = m.conta_pagar_id;
    UPDATE public.fin_contas_pagar SET status = novo_status, pago_em = CASE WHEN novo_status='pago' THEN pago_em ELSE NULL END
      WHERE id = m.conta_pagar_id;
    PERFORM public.fin_hist(m.empresa_id, 'conta_pagar', m.conta_pagar_id, 'estorno', NULL, jsonb_build_object('movimento_id', m.id, 'motivo', _motivo));
  END IF;

  IF m.conta_receber_id IS NOT NULL THEN
    UPDATE public.fin_contas_receber SET valor_recebido = GREATEST(valor_recebido - m.valor, 0) WHERE id = m.conta_receber_id
      RETURNING valor_recebido INTO novo;
    SELECT CASE WHEN novo <= 0.005 THEN 'aberto' WHEN novo >= valor - 0.005 THEN 'recebido' ELSE 'parcialmente_recebido' END
      INTO novo_status FROM public.fin_contas_receber WHERE id = m.conta_receber_id;
    UPDATE public.fin_contas_receber SET status = novo_status, recebido_em = CASE WHEN novo_status='recebido' THEN recebido_em ELSE NULL END
      WHERE id = m.conta_receber_id;
    PERFORM public.fin_hist(m.empresa_id, 'conta_receber', m.conta_receber_id, 'estorno', NULL, jsonb_build_object('movimento_id', m.id, 'motivo', _motivo));
  END IF;

  IF m.adiantamento_id IS NOT NULL THEN
    UPDATE public.fin_adiantamentos SET valor_pago = GREATEST(valor_pago - m.valor, 0), status='estornado' WHERE id = m.adiantamento_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ===== Adiantamentos =====
CREATE OR REPLACE FUNCTION public.fin_aprovar_adiantamento(_id uuid, _valor_aprovado numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.fin_adiantamentos;
BEGIN
  SELECT * INTO a FROM public.fin_adiantamentos WHERE id=_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Adiantamento não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.adiantamentos.approve', a.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para aprovar.'; END IF;
  IF a.status <> 'solicitado' THEN RAISE EXCEPTION 'Só é possível aprovar adiantamento solicitado.'; END IF;
  UPDATE public.fin_adiantamentos SET status='aprovado', valor_aprovado=COALESCE(_valor_aprovado, a.valor_solicitado),
    aprovado_por=auth.uid(), aprovado_em=now() WHERE id=_id;
  PERFORM public.fin_hist(a.empresa_id,'adiantamento',_id,'aprovacao', jsonb_build_object('status',a.status), jsonb_build_object('status','aprovado','valor',COALESCE(_valor_aprovado,a.valor_solicitado)));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.fin_pagar_adiantamento(
  _id uuid, _valor numeric DEFAULT NULL, _conta_id uuid DEFAULT NULL, _forma text DEFAULT NULL,
  _data date DEFAULT CURRENT_DATE, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.fin_adiantamentos; v numeric; mov_id uuid; existente uuid;
BEGIN
  SELECT * INTO a FROM public.fin_adiantamentos WHERE id=_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Adiantamento não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.adiantamentos.manage', a.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF a.status <> 'aprovado' THEN RAISE EXCEPTION 'Adiantamento precisa estar aprovado para pagamento.'; END IF;
  v := COALESCE(_valor, a.valor_aprovado, a.valor_solicitado);
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO existente FROM public.fin_movimentos WHERE empresa_id=a.empresa_id AND idempotency_key=_idempotency_key;
    IF existente IS NOT NULL THEN RETURN jsonb_build_object('movimento_id', existente, 'repetido', true); END IF;
  END IF;
  INSERT INTO public.fin_movimentos (empresa_id, tipo, conta_id, adiantamento_id, valor, data, forma, idempotency_key, created_by)
  VALUES (a.empresa_id,'pagamento', COALESCE(_conta_id,a.conta_id), a.id, v, COALESCE(_data,CURRENT_DATE), _forma, _idempotency_key, auth.uid())
  RETURNING id INTO mov_id;
  UPDATE public.fin_adiantamentos SET status='pago', valor_pago=a.valor_pago+v, conta_id=COALESCE(_conta_id,conta_id), forma_pagamento=COALESCE(_forma,forma_pagamento) WHERE id=_id;
  PERFORM public.fin_hist(a.empresa_id,'adiantamento',_id,'pagamento', jsonb_build_object('status',a.status), jsonb_build_object('status','pago','valor',v,'movimento_id',mov_id));
  RETURN jsonb_build_object('movimento_id', mov_id);
END; $$;

CREATE OR REPLACE FUNCTION public.fin_acertar_adiantamento(_id uuid, _valor numeric, _observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.fin_adiantamentos; total numeric; novo_status text;
BEGIN
  SELECT * INTO a FROM public.fin_adiantamentos WHERE id=_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Adiantamento não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.adiantamentos.manage', a.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF a.status NOT IN ('pago','parcialmente_acertado') THEN RAISE EXCEPTION 'Só é possível acertar adiantamento pago.'; END IF;
  total := a.valor_acertado + COALESCE(_valor,0);
  novo_status := CASE WHEN total >= a.valor_pago - 0.005 THEN 'acertado' ELSE 'parcialmente_acertado' END;
  UPDATE public.fin_adiantamentos SET valor_acertado=total, status=novo_status,
    observacao=COALESCE(_observacao, observacao) WHERE id=_id;
  PERFORM public.fin_hist(a.empresa_id,'adiantamento',_id,'acerto', jsonb_build_object('acertado',a.valor_acertado), jsonb_build_object('acertado',total,'status',novo_status));
  RETURN jsonb_build_object('status', novo_status, 'saldo', a.valor_pago - total);
END; $$;

-- ===== Faturamento de minuta =====
CREATE OR REPLACE FUNCTION public.fin_faturar_minuta(
  _minuta_id uuid, _vencimento date DEFAULT NULL, _conta_id uuid DEFAULT NULL, _empresa_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; emp uuid; cr_id uuid; fat_id uuid; reg_cliente uuid; nome text;
BEGIN
  SELECT mi.*, c.nome AS cliente_nome, c.registry_cliente_id
    INTO m FROM public.tms_minutas mi
    LEFT JOIN public.tms_clientes c ON c.id = mi.cliente_id
   WHERE mi.id = _minuta_id FOR UPDATE OF mi;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Minuta não encontrada.'; END IF;
  emp := COALESCE(m.empresa_id, _empresa_id);
  IF emp IS NULL THEN RAISE EXCEPTION 'Minuta sem empresa definida.'; END IF;
  IF NOT public.financeiro_can('financeiro.faturamento.manage', emp) THEN RAISE EXCEPTION 'Sem permissão para faturar.'; END IF;
  IF m.status <> 'entregue' THEN RAISE EXCEPTION 'Só é possível faturar após a entrega.'; END IF;
  IF m.status_financeiro = 'faturado' THEN RAISE EXCEPTION 'Minuta já faturada.'; END IF;
  IF COALESCE(m.valor_frete,0) <= 0 THEN RAISE EXCEPTION 'Minuta sem valor de frete.'; END IF;

  reg_cliente := m.registry_cliente_id;
  nome := COALESCE(m.cliente_nome, 'Cliente');

  INSERT INTO public.fin_contas_receber (empresa_id, cliente_id, cliente_nome, descricao, valor, competencia,
    vencimento, origem, origem_tipo, origem_id, documento, status, conta_id, created_by)
  VALUES (emp, reg_cliente, nome, 'Frete minuta #' || m.numero, m.valor_frete, CURRENT_DATE,
    COALESCE(_vencimento, CURRENT_DATE + 30), 'tms', 'minuta', m.id, m.numero::text, 'aberto', _conta_id, auth.uid())
  RETURNING id INTO cr_id;

  INSERT INTO public.fin_faturamentos (empresa_id, cliente_id, cliente_nome, origem_tipo, origem_id, origem_numero,
    descricao, valor, competencia, emissao, vencimento, conta_receber_id, status, created_by)
  VALUES (emp, reg_cliente, nome, 'minuta', m.id, m.numero::text,
    'Faturamento da minuta #' || m.numero, m.valor_frete, CURRENT_DATE, CURRENT_DATE,
    COALESCE(_vencimento, CURRENT_DATE + 30), cr_id, 'faturado', auth.uid())
  RETURNING id INTO fat_id;

  UPDATE public.tms_minutas SET status_financeiro = 'faturado' WHERE id = m.id;
  PERFORM public.fin_hist(emp,'faturamento', fat_id, 'faturamento', NULL,
    jsonb_build_object('minuta', m.numero, 'valor', m.valor_frete, 'conta_receber_id', cr_id));
  RETURN jsonb_build_object('faturamento_id', fat_id, 'conta_receber_id', cr_id);
END; $$;

-- ===== Comissão: gerar título e pagar =====
CREATE OR REPLACE FUNCTION public.fin_agendar_comissao(_comissao_id uuid, _vencimento date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.pxsales_comissoes; cp_id uuid; nome text;
BEGIN
  SELECT * INTO c FROM public.pxsales_comissoes WHERE id=_comissao_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Comissão não encontrada.'; END IF;
  IF NOT public.financeiro_can('financeiro.comissoes.pay', c.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para pagar comissões.'; END IF;
  IF c.estornada_em IS NOT NULL THEN RAISE EXCEPTION 'Comissão estornada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.fin_contas_pagar WHERE origem_tipo='comissao' AND origem_id=c.id AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Comissão já possui título financeiro.'; END IF;
  SELECT COALESCE(nome_completo, email, 'Responsável') INTO nome FROM public.px_usuarios_meta WHERE user_id = c.responsavel_id;
  INSERT INTO public.fin_contas_pagar (empresa_id, fornecedor_nome, descricao, valor, competencia, vencimento,
    origem, origem_tipo, origem_id, status, created_by)
  VALUES (c.empresa_id, COALESCE(nome,'Responsável comercial'),
    'Comissão ' || COALESCE(c.competencia::text, to_char(CURRENT_DATE,'YYYY-MM')), c.valor,
    COALESCE(c.competencia, CURRENT_DATE), COALESCE(_vencimento, CURRENT_DATE + 15),
    'pxsales', 'comissao', c.id, 'aberto', auth.uid())
  RETURNING id INTO cp_id;
  PERFORM public.fin_hist(c.empresa_id,'comissao',c.id,'agendamento',NULL, jsonb_build_object('conta_pagar_id', cp_id));
  RETURN jsonb_build_object('conta_pagar_id', cp_id);
END; $$;

-- ===== Recibo =====
CREATE OR REPLACE FUNCTION public.fin_emitir_recibo(
  _empresa_id uuid, _tipo text, _beneficiario text, _documento text, _descricao text,
  _valor numeric, _data date DEFAULT CURRENT_DATE, _forma text DEFAULT NULL,
  _origem_tipo text DEFAULT NULL, _origem_id uuid DEFAULT NULL, _movimento_id uuid DEFAULT NULL,
  _reemissao_de uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r_id uuid; num bigint; v integer := 1;
BEGIN
  IF NOT public.financeiro_can('financeiro.recibos.generate', _empresa_id) THEN RAISE EXCEPTION 'Sem permissão para emitir recibos.'; END IF;
  IF _reemissao_de IS NOT NULL THEN
    SELECT via + 1 INTO v FROM public.fin_recibos WHERE id = _reemissao_de;
  END IF;
  INSERT INTO public.fin_recibos (empresa_id, tipo, beneficiario_nome, beneficiario_documento, descricao, valor,
    data, forma_pagamento, origem_tipo, origem_id, movimento_id, via, reemissao_de, created_by)
  VALUES (_empresa_id, COALESCE(_tipo,'pagamento'), _beneficiario, _documento, _descricao, _valor,
    COALESCE(_data, CURRENT_DATE), _forma, _origem_tipo, _origem_id, _movimento_id, COALESCE(v,1), _reemissao_de, auth.uid())
  RETURNING id, numero INTO r_id, num;
  PERFORM public.fin_hist(_empresa_id,'recibo', r_id, 'emissao', NULL, jsonb_build_object('numero', num, 'via', v));
  RETURN jsonb_build_object('recibo_id', r_id, 'numero', num, 'via', v);
END; $$;

-- ===== Vencidos =====
CREATE OR REPLACE FUNCTION public.fin_marcar_vencidos(_empresa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a int; b int;
BEGIN
  IF NOT public.financeiro_can('financeiro.view', _empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  UPDATE public.fin_contas_pagar SET status='vencido'
    WHERE empresa_id=_empresa_id AND status IN ('aberto','previsto','parcialmente_pago') AND vencimento < CURRENT_DATE;
  GET DIAGNOSTICS a = ROW_COUNT;
  UPDATE public.fin_contas_receber SET status='vencido'
    WHERE empresa_id=_empresa_id AND status IN ('aberto','previsto','parcialmente_recebido') AND vencimento < CURRENT_DATE;
  GET DIAGNOSTICS b = ROW_COUNT;
  RETURN jsonb_build_object('pagar', a, 'receber', b);
END; $$;

REVOKE EXECUTE ON FUNCTION public.fin_hist(uuid,text,uuid,text,jsonb,jsonb) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.fin_registrar_pagamento(uuid,numeric,date,uuid,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_registrar_recebimento(uuid,numeric,date,uuid,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_cancelar_titulo(text,uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_estornar_movimento(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_aprovar_adiantamento(uuid,numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_pagar_adiantamento(uuid,numeric,uuid,text,date,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_acertar_adiantamento(uuid,numeric,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_faturar_minuta(uuid,date,uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_agendar_comissao(uuid,date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_emitir_recibo(uuid,text,text,text,text,numeric,date,text,text,uuid,uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fin_marcar_vencidos(uuid) FROM anon, public;