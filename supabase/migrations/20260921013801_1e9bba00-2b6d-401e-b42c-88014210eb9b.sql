-- ============ 1. SANEAMENTO + ESTRUTURA ============

ALTER TABLE public.fin_contas
  ADD COLUMN IF NOT EXISTS saldo_inicial_data date NOT NULL DEFAULT CURRENT_DATE;
COMMENT ON COLUMN public.fin_contas.saldo_inicial IS 'Saldo de abertura da conta na data saldo_inicial_data. O saldo atual = saldo_inicial + movimentos não estornados com data <= hoje.';

-- Recibos: vínculos financeiros e justificativa de emissão manual
ALTER TABLE public.fin_recibos
  ADD COLUMN IF NOT EXISTS conta_pagar_id uuid REFERENCES public.fin_contas_pagar(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_receber_id uuid REFERENCES public.fin_contas_receber(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adiantamento_id uuid REFERENCES public.fin_adiantamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comissao_id uuid REFERENCES public.pxsales_comissoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folha_item_id uuid REFERENCES public.fin_folha_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa text;

ALTER TABLE public.fin_recibos DROP CONSTRAINT IF EXISTS fin_recibos_tipo_check;
ALTER TABLE public.fin_recibos ADD CONSTRAINT fin_recibos_tipo_check
  CHECK (tipo = ANY (ARRAY['pagamento','recebimento','adiantamento','acerto','comissao','folha','prestacao_servico','outro']));

-- Adiantamentos: status parcial + invariantes de valor
ALTER TABLE public.fin_adiantamentos DROP CONSTRAINT IF EXISTS fin_adiantamentos_status_check;
ALTER TABLE public.fin_adiantamentos ADD CONSTRAINT fin_adiantamentos_status_check
  CHECK (status = ANY (ARRAY['solicitado','aprovado','parcialmente_pago','pago','parcialmente_acertado','acertado','cancelado','rejeitado','estornado']));

UPDATE public.fin_adiantamentos SET valor_acertado = valor_pago WHERE valor_acertado > valor_pago;
UPDATE public.fin_adiantamentos SET valor_aprovado = valor_pago
  WHERE valor_aprovado IS NOT NULL AND valor_pago > valor_aprovado;

ALTER TABLE public.fin_adiantamentos DROP CONSTRAINT IF EXISTS fin_adto_valores_chk;
ALTER TABLE public.fin_adiantamentos ADD CONSTRAINT fin_adto_valores_chk CHECK (
  valor_pago >= 0 AND valor_acertado >= 0
  AND valor_acertado <= valor_pago + 0.005
  AND (valor_aprovado IS NULL OR valor_pago <= valor_aprovado + 0.005)
);

-- Idempotência de origem nos títulos (folha, comissão, faturamento, etc.)
CREATE UNIQUE INDEX IF NOT EXISTS fin_contas_pagar_origem_uidx
  ON public.fin_contas_pagar (empresa_id, origem_tipo, origem_id)
  WHERE origem_id IS NOT NULL AND status <> 'cancelado';
CREATE UNIQUE INDEX IF NOT EXISTS fin_contas_receber_origem_uidx
  ON public.fin_contas_receber (empresa_id, origem_tipo, origem_id)
  WHERE origem_id IS NOT NULL AND status <> 'cancelado';

-- ============ 2. SALDOS (saldo atual != movimentação do período) ============

CREATE OR REPLACE FUNCTION public.fin_saldos(_empresa_ids uuid[], _de date DEFAULT NULL, _ate date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE emps uuid[]; res jsonb; de date; ate date;
BEGIN
  SELECT COALESCE(array_agg(e), '{}') INTO emps
    FROM unnest(COALESCE(_empresa_ids,'{}'::uuid[])) e
   WHERE public.financeiro_can('financeiro.dashboard.view', e);
  IF array_length(emps,1) IS NULL THEN
    RETURN jsonb_build_object('contas','[]'::jsonb,'saldo_consolidado',0,'entradas_periodo',0,'saidas_periodo',0);
  END IF;
  de  := COALESCE(_de, CURRENT_DATE - 89);
  ate := COALESCE(_ate, CURRENT_DATE);

  WITH mov AS (
    SELECT m.* FROM public.fin_movimentos m
     WHERE m.empresa_id = ANY(emps) AND m.estornado_em IS NULL
  ),
  por_conta AS (
    SELECT c.id, c.nome, c.empresa_id, c.tipo, c.saldo_inicial, c.saldo_inicial_data,
           c.saldo_inicial + COALESCE(SUM(
             CASE WHEN m.tipo='recebimento' THEN m.valor ELSE -m.valor END
           ) FILTER (WHERE m.data <= CURRENT_DATE), 0) AS saldo_atual
      FROM public.fin_contas c
      LEFT JOIN mov m ON m.conta_id = c.id
     WHERE c.empresa_id = ANY(emps)
     GROUP BY c.id
  )
  SELECT jsonb_build_object(
    'contas', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nome) FROM por_conta p), '[]'::jsonb),
    'saldo_contas', COALESCE((SELECT SUM(saldo_atual) FROM por_conta), 0),
    'saldo_sem_conta', COALESCE((SELECT SUM(CASE WHEN tipo='recebimento' THEN valor ELSE -valor END)
                                   FROM mov WHERE conta_id IS NULL AND data <= CURRENT_DATE), 0),
    'entradas_periodo', COALESCE((SELECT SUM(valor) FROM mov WHERE tipo='recebimento' AND data BETWEEN de AND ate),0),
    'saidas_periodo',   COALESCE((SELECT SUM(valor) FROM mov WHERE tipo='pagamento'   AND data BETWEEN de AND ate),0),
    'periodo', jsonb_build_object('de', de, 'ate', ate)
  ) INTO res;

  res := res || jsonb_build_object('saldo_consolidado',
    (res->>'saldo_contas')::numeric + (res->>'saldo_sem_conta')::numeric);
  RETURN res;
END; $$;
REVOKE ALL ON FUNCTION public.fin_saldos(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_saldos(uuid[], date, date) TO authenticated;

-- ============ 3. ADIANTAMENTOS ============

CREATE OR REPLACE FUNCTION public.fin_pagar_adiantamento(_id uuid, _valor numeric DEFAULT NULL, _conta_id uuid DEFAULT NULL,
  _forma text DEFAULT NULL, _data date DEFAULT CURRENT_DATE, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.fin_adiantamentos; v numeric; aprovado numeric; saldo numeric;
        mov_id uuid; existente uuid; novo_pago numeric; novo_status text;
BEGIN
  SELECT * INTO a FROM public.fin_adiantamentos WHERE id=_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Adiantamento não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.adiantamentos.manage', a.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO existente FROM public.fin_movimentos
      WHERE empresa_id=a.empresa_id AND idempotency_key=_idempotency_key;
    IF existente IS NOT NULL THEN RETURN jsonb_build_object('movimento_id', existente, 'repetido', true); END IF;
  END IF;

  IF a.status NOT IN ('aprovado','parcialmente_pago') THEN
    RAISE EXCEPTION 'Adiantamento % não aceita pagamento.', a.status; END IF;
  aprovado := COALESCE(a.valor_aprovado, a.valor_solicitado);
  saldo := aprovado - a.valor_pago;
  v := COALESCE(_valor, saldo);
  IF v <= 0 THEN RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero.'; END IF;
  IF v > saldo + 0.005 THEN
    RAISE EXCEPTION 'Valor maior que o saldo aprovado disponível (%).', round(saldo,2); END IF;

  BEGIN
    INSERT INTO public.fin_movimentos (empresa_id, tipo, conta_id, adiantamento_id, valor, data, forma, descricao, idempotency_key, created_by)
    VALUES (a.empresa_id,'pagamento', COALESCE(_conta_id,a.conta_id), a.id, v, COALESCE(_data,CURRENT_DATE), _forma,
            'Adiantamento — ' || a.beneficiario_nome, _idempotency_key, auth.uid())
    RETURNING id INTO mov_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existente FROM public.fin_movimentos
      WHERE empresa_id=a.empresa_id AND idempotency_key=_idempotency_key;
    RETURN jsonb_build_object('movimento_id', existente, 'repetido', true);
  END;

  novo_pago := a.valor_pago + v;
  novo_status := CASE WHEN novo_pago >= aprovado - 0.005 THEN 'pago' ELSE 'parcialmente_pago' END;
  UPDATE public.fin_adiantamentos
     SET valor_pago=novo_pago, status=novo_status, conta_id=COALESCE(_conta_id,conta_id),
         forma_pagamento=COALESCE(_forma,forma_pagamento)
   WHERE id=_id;
  PERFORM public.fin_hist(a.empresa_id,'adiantamento',_id,'pagamento',
    jsonb_build_object('status',a.status,'valor_pago',a.valor_pago),
    jsonb_build_object('status',novo_status,'valor_pago',novo_pago,'movimento_id',mov_id));
  RETURN jsonb_build_object('movimento_id', mov_id, 'status', novo_status, 'valor_pago', novo_pago);
END; $$;

CREATE OR REPLACE FUNCTION public.fin_acertar_adiantamento(_id uuid, _valor numeric, _observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.fin_adiantamentos; total numeric; novo_status text; saldo numeric;
BEGIN
  SELECT * INTO a FROM public.fin_adiantamentos WHERE id=_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Adiantamento não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.adiantamentos.manage', a.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF a.status NOT IN ('pago','parcialmente_pago','parcialmente_acertado') THEN
    RAISE EXCEPTION 'Adiantamento % não aceita acerto.', a.status; END IF;
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor do acerto deve ser maior que zero.'; END IF;
  saldo := a.valor_pago - a.valor_acertado;
  IF _valor > saldo + 0.005 THEN
    RAISE EXCEPTION 'Valor maior que o saldo a acertar (%).', round(saldo,2); END IF;

  total := a.valor_acertado + _valor;
  novo_status := CASE WHEN total >= a.valor_pago - 0.005 THEN 'acertado' ELSE 'parcialmente_acertado' END;
  UPDATE public.fin_adiantamentos SET valor_acertado=total, status=novo_status,
    observacao=COALESCE(_observacao, observacao) WHERE id=_id;
  PERFORM public.fin_hist(a.empresa_id,'adiantamento',_id,'acerto',
    jsonb_build_object('acertado',a.valor_acertado),
    jsonb_build_object('acertado',total,'status',novo_status));
  RETURN jsonb_build_object('status', novo_status, 'saldo', a.valor_pago - total);
END; $$;

-- ============ 4. ESTORNO (recalcula adiantamento em vez de zerar o estado) ============

CREATE OR REPLACE FUNCTION public.fin_estornar_movimento(_movimento_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.fin_movimentos; novo numeric; novo_status text; a public.fin_adiantamentos; aprovado numeric;
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
    SELECT CASE WHEN novo <= 0.005 THEN (CASE WHEN vencimento < CURRENT_DATE THEN 'vencido' ELSE 'aberto' END)
                WHEN novo >= valor - 0.005 THEN 'pago' ELSE 'parcialmente_pago' END
      INTO novo_status FROM public.fin_contas_pagar WHERE id = m.conta_pagar_id;
    UPDATE public.fin_contas_pagar SET status = novo_status,
           pago_em = CASE WHEN novo_status='pago' THEN pago_em ELSE NULL END
     WHERE id = m.conta_pagar_id;
    PERFORM public.fin_hist(m.empresa_id,'conta_pagar', m.conta_pagar_id,'estorno',NULL,
      jsonb_build_object('movimento_id', m.id,'motivo',_motivo,'status',novo_status));
  END IF;

  IF m.conta_receber_id IS NOT NULL THEN
    UPDATE public.fin_contas_receber SET valor_recebido = GREATEST(valor_recebido - m.valor, 0) WHERE id = m.conta_receber_id
      RETURNING valor_recebido INTO novo;
    SELECT CASE WHEN novo <= 0.005 THEN (CASE WHEN vencimento < CURRENT_DATE THEN 'vencido' ELSE 'aberto' END)
                WHEN novo >= valor - 0.005 THEN 'recebido' ELSE 'parcialmente_recebido' END
      INTO novo_status FROM public.fin_contas_receber WHERE id = m.conta_receber_id;
    UPDATE public.fin_contas_receber SET status = novo_status,
           recebido_em = CASE WHEN novo_status='recebido' THEN recebido_em ELSE NULL END
     WHERE id = m.conta_receber_id;
    PERFORM public.fin_hist(m.empresa_id,'conta_receber', m.conta_receber_id,'estorno',NULL,
      jsonb_build_object('movimento_id', m.id,'motivo',_motivo,'status',novo_status));
  END IF;

  IF m.adiantamento_id IS NOT NULL THEN
    SELECT * INTO a FROM public.fin_adiantamentos WHERE id = m.adiantamento_id FOR UPDATE;
    novo := GREATEST(a.valor_pago - m.valor, 0);
    aprovado := COALESCE(a.valor_aprovado, a.valor_solicitado);
    novo_status := CASE WHEN novo <= 0.005 THEN 'aprovado'
                        WHEN novo >= aprovado - 0.005 THEN 'pago' ELSE 'parcialmente_pago' END;
    UPDATE public.fin_adiantamentos
       SET valor_pago = novo, valor_acertado = LEAST(valor_acertado, novo), status = novo_status
     WHERE id = a.id;
    PERFORM public.fin_hist(m.empresa_id,'adiantamento', a.id,'estorno',
      jsonb_build_object('valor_pago',a.valor_pago),
      jsonb_build_object('valor_pago',novo,'status',novo_status,'motivo',_motivo));
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ============ 5. FOLHA TRANSACIONAL ============

CREATE OR REPLACE FUNCTION public.fin_gerar_pagamentos_folha(_periodo_id uuid, _vencimento date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.fin_folha_periodos; it record; cp_id uuid; criados int := 0; existentes int := 0; venc date; liq numeric;
BEGIN
  SELECT * INTO p FROM public.fin_folha_periodos WHERE id=_periodo_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Período não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.folha.approve', p.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para aprovar a folha.'; END IF;
  IF p.status = 'cancelada' THEN RAISE EXCEPTION 'Período cancelado.'; END IF;
  venc := COALESCE(_vencimento, p.fim + 5, CURRENT_DATE);

  FOR it IN
    SELECT i.*, ps.nome AS pessoa_nome
      FROM public.fin_folha_itens i
      JOIN public.fin_pessoas ps ON ps.id = i.pessoa_id
     WHERE i.periodo_id = p.id AND i.status <> 'cancelado'
     ORDER BY ps.nome
     FOR UPDATE OF i
  LOOP
    liq := COALESCE(it.valor_base,0) + COALESCE(it.adicionais,0) + COALESCE(it.ajustes,0)
         - COALESCE(it.descontos,0) - COALESCE(it.adiantamentos,0);
    IF liq <= 0 THEN RAISE EXCEPTION 'Item de % tem valor líquido inválido (%).', it.pessoa_nome, round(liq,2); END IF;
    IF it.empresa_id <> p.empresa_id THEN RAISE EXCEPTION 'Item de outra empresa no período.'; END IF;

    IF it.conta_pagar_id IS NOT NULL THEN existentes := existentes + 1; CONTINUE; END IF;

    INSERT INTO public.fin_contas_pagar (empresa_id, fornecedor_id, fornecedor_nome, descricao, valor,
      competencia, vencimento, origem, origem_tipo, origem_id, status, created_by)
    VALUES (p.empresa_id, it.pessoa_id, it.pessoa_nome,
      'Folha ' || p.referencia || ' — ' || it.pessoa_nome, liq,
      p.fim, venc, 'folha', 'folha_item', it.id, 'aberto', auth.uid())
    RETURNING id INTO cp_id;

    UPDATE public.fin_folha_itens SET valor_liquido = liq, conta_pagar_id = cp_id, status='aprovado' WHERE id = it.id;
    criados := criados + 1;
  END LOOP;

  UPDATE public.fin_folha_periodos
     SET status='aprovada', aprovado_por=auth.uid(), aprovado_em=now() WHERE id=p.id;
  PERFORM public.fin_hist(p.empresa_id,'folha_periodo',p.id,'geracao_pagamentos',
    jsonb_build_object('status',p.status), jsonb_build_object('criados',criados,'existentes',existentes,'status','aprovada'));
  RETURN jsonb_build_object('criados', criados, 'existentes', existentes);
END; $$;
REVOKE ALL ON FUNCTION public.fin_gerar_pagamentos_folha(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_gerar_pagamentos_folha(uuid, date) TO authenticated;

-- ============ 6. RECIBOS A PARTIR DO FATO FINANCEIRO ============

CREATE OR REPLACE FUNCTION public.fin_emitir_recibo(_empresa_id uuid, _tipo text, _beneficiario text, _documento text,
  _descricao text, _valor numeric, _data date DEFAULT CURRENT_DATE, _forma text DEFAULT NULL,
  _origem_tipo text DEFAULT NULL, _origem_id uuid DEFAULT NULL, _movimento_id uuid DEFAULT NULL,
  _reemissao_de uuid DEFAULT NULL, _justificativa text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r_id uuid; num bigint; v integer := 1; m public.fin_movimentos; emp uuid;
        val numeric; dt date; frm text; tp text; benef text; doc text;
        cp uuid; cr uuid; adto uuid;
BEGIN
  emp := _empresa_id;
  IF _movimento_id IS NOT NULL THEN
    SELECT * INTO m FROM public.fin_movimentos WHERE id = _movimento_id;
    IF m.id IS NULL THEN RAISE EXCEPTION 'Movimento não encontrado.'; END IF;
    IF m.estornado_em IS NOT NULL THEN RAISE EXCEPTION 'Movimento estornado não gera recibo.'; END IF;
    emp := m.empresa_id;
  END IF;
  IF emp IS NULL THEN RAISE EXCEPTION 'Empresa não informada.'; END IF;
  IF NOT (public.financeiro_can('financeiro.recibos.generate', emp)
          OR public.financeiro_can('financeiro.recibos.manage', emp)) THEN
    RAISE EXCEPTION 'Sem permissão para emitir recibos.'; END IF;

  IF m.id IS NOT NULL THEN
    val := m.valor; dt := m.data; frm := COALESCE(_forma, m.forma);
    tp  := COALESCE(_tipo, CASE WHEN m.tipo='recebimento' THEN 'recebimento' ELSE 'pagamento' END);
    cp := m.conta_pagar_id; cr := m.conta_receber_id; adto := m.adiantamento_id;
    IF cp IS NOT NULL THEN SELECT fornecedor_nome INTO benef FROM public.fin_contas_pagar WHERE id=cp; END IF;
    IF cr IS NOT NULL THEN SELECT cliente_nome INTO benef FROM public.fin_contas_receber WHERE id=cr; END IF;
    IF adto IS NOT NULL THEN SELECT beneficiario_nome INTO benef FROM public.fin_adiantamentos WHERE id=adto; END IF;
    benef := COALESCE(_beneficiario, benef, 'Beneficiário');
    doc := _documento;
  ELSE
    IF _justificativa IS NULL OR btrim(_justificativa) = '' THEN
      RAISE EXCEPTION 'Recibo manual (sem movimento financeiro) exige justificativa.'; END IF;
    IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero.'; END IF;
    val := _valor; dt := COALESCE(_data, CURRENT_DATE); frm := _forma;
    tp := COALESCE(_tipo,'pagamento'); benef := _beneficiario; doc := _documento;
  END IF;

  IF _reemissao_de IS NOT NULL THEN SELECT via + 1 INTO v FROM public.fin_recibos WHERE id = _reemissao_de; END IF;

  INSERT INTO public.fin_recibos (empresa_id, tipo, beneficiario_nome, beneficiario_documento, descricao, valor,
    data, forma_pagamento, origem_tipo, origem_id, movimento_id, conta_pagar_id, conta_receber_id, adiantamento_id,
    justificativa, via, reemissao_de, created_by)
  VALUES (emp, tp, benef, doc, _descricao, val, dt, frm,
    COALESCE(_origem_tipo, CASE WHEN m.id IS NOT NULL THEN 'movimento' END), _origem_id, _movimento_id,
    cp, cr, adto, _justificativa, COALESCE(v,1), _reemissao_de, auth.uid())
  RETURNING id, numero INTO r_id, num;

  PERFORM public.fin_hist(emp,'recibo', r_id, 'emissao', NULL,
    jsonb_build_object('numero', num, 'via', v, 'movimento_id', _movimento_id, 'valor', val));
  RETURN jsonb_build_object('recibo_id', r_id, 'numero', num, 'via', v);
END; $$;

-- ============ 7. FATURAMENTO E COMISSÃO IDEMPOTENTES ============

CREATE OR REPLACE FUNCTION public.fin_faturar_minuta(_minuta_id uuid, _vencimento date DEFAULT NULL,
  _conta_id uuid DEFAULT NULL, _empresa_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  SELECT f.id, f.conta_receber_id INTO fat_id, cr_id FROM public.fin_faturamentos f
   WHERE f.empresa_id=emp AND f.origem_tipo='minuta' AND f.origem_id=m.id AND f.status <> 'cancelado';
  IF fat_id IS NOT NULL THEN
    RETURN jsonb_build_object('faturamento_id', fat_id, 'conta_receber_id', cr_id, 'repetido', true);
  END IF;

  IF m.status <> 'entregue' THEN RAISE EXCEPTION 'Só é possível faturar após a entrega.'; END IF;
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

CREATE OR REPLACE FUNCTION public.fin_agendar_comissao(_comissao_id uuid, _vencimento date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.pxsales_comissoes; cp_id uuid; nome text;
BEGIN
  SELECT * INTO c FROM public.pxsales_comissoes WHERE id=_comissao_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Comissão não encontrada.'; END IF;
  IF NOT public.financeiro_can('financeiro.comissoes.pay', c.empresa_id) THEN RAISE EXCEPTION 'Sem permissão para pagar comissões.'; END IF;
  IF c.estornada_em IS NOT NULL THEN RAISE EXCEPTION 'Comissão estornada.'; END IF;

  SELECT id INTO cp_id FROM public.fin_contas_pagar
   WHERE empresa_id=c.empresa_id AND origem_tipo='comissao' AND origem_id=c.id AND status <> 'cancelado';
  IF cp_id IS NOT NULL THEN RETURN jsonb_build_object('conta_pagar_id', cp_id, 'repetido', true); END IF;

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

-- ============ 8. CONCILIAÇÃO COM RASTRO ============

CREATE OR REPLACE FUNCTION public.fin_conciliar(_id uuid, _movimento_id uuid, _status text, _observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.fin_conciliacao; mv public.fin_movimentos;
BEGIN
  SELECT * INTO c FROM public.fin_conciliacao WHERE id=_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Lançamento de conciliação não encontrado.'; END IF;
  IF NOT public.financeiro_can('financeiro.conciliacao.manage', c.empresa_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF _status NOT IN ('nao_conciliado','conciliado','divergente','ignorado') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  IF _movimento_id IS NOT NULL THEN
    SELECT * INTO mv FROM public.fin_movimentos WHERE id=_movimento_id;
    IF mv.id IS NULL OR mv.empresa_id <> c.empresa_id THEN RAISE EXCEPTION 'Movimento inválido para esta empresa.'; END IF;
  END IF;

  UPDATE public.fin_conciliacao
     SET movimento_id = _movimento_id,
         status = _status,
         observacao = COALESCE(_observacao, observacao),
         conciliado_por = CASE WHEN _status='conciliado' THEN auth.uid() ELSE NULL END,
         conciliado_em  = CASE WHEN _status='conciliado' THEN now() ELSE NULL END
   WHERE id=_id;

  PERFORM public.fin_hist(c.empresa_id,'conciliacao',_id,
    CASE WHEN _status='conciliado' THEN 'conciliacao' ELSE 'desfazer_conciliacao' END,
    jsonb_build_object('status',c.status,'movimento_id',c.movimento_id),
    jsonb_build_object('status',_status,'movimento_id',_movimento_id));
  RETURN jsonb_build_object('ok', true, 'status', _status);
END; $$;
REVOKE ALL ON FUNCTION public.fin_conciliar(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_conciliar(uuid, uuid, text, text) TO authenticated;

-- ============ 9. PERMISSÕES COMPLEMENTARES (idempotente) ============

INSERT INTO public.px_perfil_permissoes (perfil_id, sistema_key, acao)
SELECT pp.perfil_id, 'pxfin', novo.acao
  FROM public.px_perfil_permissoes pp
  JOIN (VALUES
    ('financeiro.recibos.generate','financeiro.recibos.manage'),
    ('financeiro.comissoes.pay','financeiro.comissoes.manage'),
    ('financeiro.settings.manage','financeiro.contas.manage'),
    ('financeiro.settings.manage','financeiro.categorias.manage'),
    ('financeiro.view','financeiro.contas.view'),
    ('financeiro.view','financeiro.categorias.view')
  ) AS novo(base, acao) ON novo.base = pp.acao
 WHERE pp.sistema_key = 'pxfin'
   AND NOT EXISTS (
     SELECT 1 FROM public.px_perfil_permissoes x
      WHERE x.perfil_id = pp.perfil_id AND x.sistema_key='pxfin' AND x.acao = novo.acao);