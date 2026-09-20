CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================ TABELAS COMERCIAIS ============================
CREATE TABLE public.pxsales_tabelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente','balcao','geral','rota','servico')),
  descricao text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','inativa','arquivada')),
  portal_visivel boolean NOT NULL DEFAULT false,
  portal_mostrar_componentes boolean NOT NULL DEFAULT true,
  portal_mostrar_valores boolean NOT NULL DEFAULT false,
  responsavel_id uuid,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pxsales_tabelas_empresa ON public.pxsales_tabelas(empresa_id);
CREATE INDEX idx_pxsales_tabelas_cliente ON public.pxsales_tabelas(cliente_id);
CREATE INDEX idx_pxsales_tabelas_status ON public.pxsales_tabelas(status);

CREATE TABLE public.pxsales_tabela_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.pxsales_tabelas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicada','inativa','arquivada')),
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  ordem_calculo jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  publicada_em timestamptz,
  publicada_por uuid,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pxsales_versao UNIQUE (tabela_id, versao),
  CONSTRAINT ck_pxsales_versao_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  CONSTRAINT ex_pxsales_versao_vigencia EXCLUDE USING gist (
    tabela_id WITH =,
    daterange(vigencia_inicio, COALESCE(vigencia_fim, 'infinity'::date), '[]') WITH &&
  ) WHERE (status = 'publicada')
);
CREATE INDEX idx_pxsales_versoes_tabela ON public.pxsales_tabela_versoes(tabela_id);
CREATE INDEX idx_pxsales_versoes_empresa ON public.pxsales_tabela_versoes(empresa_id);

CREATE TABLE public.pxsales_tabela_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.pxsales_tabela_versoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  codigo text NOT NULL,
  tipo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pxsales_componente UNIQUE (versao_id, codigo)
);
CREATE INDEX idx_pxsales_comp_versao ON public.pxsales_tabela_componentes(versao_id);

CREATE TABLE public.pxsales_tabela_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  componente_id uuid NOT NULL REFERENCES public.pxsales_tabela_componentes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  peso_min numeric NOT NULL DEFAULT 0,
  peso_max numeric NOT NULL,
  tipo_valor text NOT NULL DEFAULT 'fixo' CHECK (tipo_valor IN ('fixo','por_kg','percentual')),
  valor numeric NOT NULL DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_pxsales_faixa CHECK (peso_max > peso_min AND peso_min >= 0),
  CONSTRAINT ex_pxsales_faixa_overlap EXCLUDE USING gist (
    componente_id WITH =,
    numrange(peso_min, peso_max, '[)') WITH &&
  )
);
CREATE INDEX idx_pxsales_faixa_comp ON public.pxsales_tabela_faixas(componente_id);

-- ============================ COTAÇÃO / SNAPSHOT ============================
ALTER TABLE public.pxsales_cotacoes
  ADD COLUMN IF NOT EXISTS tabela_id uuid REFERENCES public.pxsales_tabelas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tabela_versao_id uuid REFERENCES public.pxsales_tabela_versoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tabela_nome text,
  ADD COLUMN IF NOT EXISTS tabela_versao integer,
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.pxsales_cotacao_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.pxsales_cotacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  ordem integer NOT NULL DEFAULT 0,
  codigo text NOT NULL,
  nome text NOT NULL,
  base numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pxsales_cotcomp_cotacao ON public.pxsales_cotacao_componentes(cotacao_id);

-- ============================ PORTAL DO CLIENTE ============================
CREATE TABLE public.pxsales_portal_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz,
  ver_tabela boolean NOT NULL DEFAULT true,
  ver_componentes boolean NOT NULL DEFAULT true,
  ver_valores boolean NOT NULL DEFAULT false,
  ver_cotacoes boolean NOT NULL DEFAULT true,
  ver_historico boolean NOT NULL DEFAULT true,
  solicitar_cotacao boolean NOT NULL DEFAULT true,
  ver_entregas boolean NOT NULL DEFAULT true,
  ver_comprovantes boolean NOT NULL DEFAULT true,
  baixar_comprovantes boolean NOT NULL DEFAULT false,
  ver_documentos_fiscais boolean NOT NULL DEFAULT false,
  ultimo_acesso_em timestamptz,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pxsales_portal_acessos_cliente ON public.pxsales_portal_acessos(cliente_id);
CREATE INDEX idx_pxsales_portal_acessos_empresa ON public.pxsales_portal_acessos(empresa_id);

-- ================================= GRANTS ==================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_tabelas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_tabela_versoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_tabela_componentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_tabela_faixas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_cotacao_componentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pxsales_portal_acessos TO authenticated;
GRANT ALL ON public.pxsales_tabelas TO service_role;
GRANT ALL ON public.pxsales_tabela_versoes TO service_role;
GRANT ALL ON public.pxsales_tabela_componentes TO service_role;
GRANT ALL ON public.pxsales_tabela_faixas TO service_role;
GRANT ALL ON public.pxsales_cotacao_componentes TO service_role;
GRANT ALL ON public.pxsales_portal_acessos TO service_role;

-- ================================== RLS ====================================
ALTER TABLE public.pxsales_tabelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_tabela_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_tabela_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_tabela_faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_cotacao_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_portal_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tab_select ON public.pxsales_tabelas FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.tabelas.view', empresa_id));
CREATE POLICY tab_insert ON public.pxsales_tabelas FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.tabelas.create', empresa_id));
CREATE POLICY tab_update ON public.pxsales_tabelas FOR UPDATE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id))
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY tab_delete ON public.pxsales_tabelas FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.tabelas.manage', empresa_id));

CREATE POLICY ver_select ON public.pxsales_tabela_versoes FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.tabelas.view', empresa_id));
CREATE POLICY ver_insert ON public.pxsales_tabela_versoes FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.tabelas.create', empresa_id));
CREATE POLICY ver_update ON public.pxsales_tabela_versoes FOR UPDATE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id))
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY ver_delete ON public.pxsales_tabela_versoes FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.tabelas.manage', empresa_id));

CREATE POLICY comp_select ON public.pxsales_tabela_componentes FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.tabelas.view', empresa_id));
CREATE POLICY comp_insert ON public.pxsales_tabela_componentes FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY comp_update ON public.pxsales_tabela_componentes FOR UPDATE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id))
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY comp_delete ON public.pxsales_tabela_componentes FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id));

CREATE POLICY faixa_select ON public.pxsales_tabela_faixas FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.tabelas.view', empresa_id));
CREATE POLICY faixa_insert ON public.pxsales_tabela_faixas FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY faixa_update ON public.pxsales_tabela_faixas FOR UPDATE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id))
  WITH CHECK (pxsales_can('pxsales.tabelas.edit', empresa_id));
CREATE POLICY faixa_delete ON public.pxsales_tabela_faixas FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.tabelas.edit', empresa_id));

CREATE POLICY cotcomp_select ON public.pxsales_cotacao_componentes FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.cotacoes.view', empresa_id));
CREATE POLICY cotcomp_insert ON public.pxsales_cotacao_componentes FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.cotacoes.create', empresa_id));
CREATE POLICY cotcomp_delete ON public.pxsales_cotacao_componentes FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.cotacoes.edit', empresa_id));

CREATE POLICY portalacc_select ON public.pxsales_portal_acessos FOR SELECT TO authenticated
  USING (pxsales_can('pxsales.portal.manage', empresa_id));
CREATE POLICY portalacc_insert ON public.pxsales_portal_acessos FOR INSERT TO authenticated
  WITH CHECK (pxsales_can('pxsales.portal.manage', empresa_id));
CREATE POLICY portalacc_update ON public.pxsales_portal_acessos FOR UPDATE TO authenticated
  USING (pxsales_can('pxsales.portal.manage', empresa_id))
  WITH CHECK (pxsales_can('pxsales.portal.manage', empresa_id));
CREATE POLICY portalacc_delete ON public.pxsales_portal_acessos FOR DELETE TO authenticated
  USING (pxsales_can('pxsales.portal.manage', empresa_id));

-- ================================ TRIGGERS =================================
CREATE TRIGGER set_pxsales_tabelas_updated BEFORE UPDATE ON public.pxsales_tabelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_versoes_updated BEFORE UPDATE ON public.pxsales_tabela_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_componentes_updated BEFORE UPDATE ON public.pxsales_tabela_componentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_pxsales_portal_acessos_updated BEFORE UPDATE ON public.pxsales_portal_acessos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================ RPCs TRANSACIONAIS ===========================
CREATE OR REPLACE FUNCTION public.pxsales_publicar_versao(_versao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v record; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO v FROM pxsales_tabela_versoes WHERE id = _versao_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'Versão não encontrada.'; END IF;
  IF NOT pxsales_can('pxsales.tabelas.publish', v.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para publicar tabelas nesta empresa.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pxsales_tabela_componentes c WHERE c.versao_id = _versao_id AND c.ativo) THEN
    RAISE EXCEPTION 'A versão precisa de pelo menos um componente ativo.';
  END IF;

  UPDATE pxsales_tabela_versoes
     SET status = 'inativa', updated_by = _uid
   WHERE tabela_id = v.tabela_id AND id <> _versao_id AND status = 'publicada'
     AND daterange(vigencia_inicio, COALESCE(vigencia_fim, 'infinity'::date), '[]')
      && daterange(v.vigencia_inicio, COALESCE(v.vigencia_fim, 'infinity'::date), '[]');

  UPDATE pxsales_tabela_versoes
     SET status = 'publicada', publicada_em = now(), publicada_por = _uid, updated_by = _uid
   WHERE id = _versao_id;

  RETURN _versao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pxsales_nova_versao(_tabela_id uuid, _vigencia_inicio date, _vigencia_fim date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record; origem uuid; nova uuid; prox int; c record; novo_comp uuid;
BEGIN
  SELECT * INTO t FROM pxsales_tabelas WHERE id = _tabela_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Tabela não encontrada.'; END IF;
  IF NOT pxsales_can('pxsales.tabelas.create', t.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar versões nesta empresa.';
  END IF;

  SELECT COALESCE(MAX(versao), 0) + 1 INTO prox FROM pxsales_tabela_versoes WHERE tabela_id = _tabela_id;
  SELECT id INTO origem FROM pxsales_tabela_versoes WHERE tabela_id = _tabela_id ORDER BY versao DESC LIMIT 1;

  INSERT INTO pxsales_tabela_versoes (tabela_id, empresa_id, versao, status, vigencia_inicio, vigencia_fim, ordem_calculo, created_by)
  SELECT _tabela_id, t.empresa_id, prox, 'rascunho',
         COALESCE(_vigencia_inicio, CURRENT_DATE), _vigencia_fim,
         COALESCE((SELECT ordem_calculo FROM pxsales_tabela_versoes WHERE id = origem), '[]'::jsonb),
         auth.uid()
  RETURNING id INTO nova;

  IF origem IS NOT NULL THEN
    FOR c IN SELECT * FROM pxsales_tabela_componentes WHERE versao_id = origem LOOP
      INSERT INTO pxsales_tabela_componentes (versao_id, empresa_id, codigo, tipo, nome, ativo, ordem, config)
      VALUES (nova, t.empresa_id, c.codigo, c.tipo, c.nome, c.ativo, c.ordem, c.config)
      RETURNING id INTO novo_comp;
      INSERT INTO pxsales_tabela_faixas (componente_id, empresa_id, peso_min, peso_max, tipo_valor, valor, valor_minimo)
      SELECT novo_comp, t.empresa_id, f.peso_min, f.peso_max, f.tipo_valor, f.valor, f.valor_minimo
        FROM pxsales_tabela_faixas f WHERE f.componente_id = c.id;
    END LOOP;
  END IF;

  RETURN nova;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pxsales_publicar_versao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pxsales_nova_versao(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pxsales_publicar_versao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pxsales_nova_versao(uuid, date, date) TO authenticated;