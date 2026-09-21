
CREATE TABLE IF NOT EXISTS public.tms_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  unidade text NOT NULL DEFAULT 'un',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tms_servicos_codigo_uidx ON public.tms_servicos (lower(codigo));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_servicos TO authenticated;
GRANT ALL ON public.tms_servicos TO service_role;
ALTER TABLE public.tms_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tms_servicos_auth_all ON public.tms_servicos;
CREATE POLICY tms_servicos_auth_all ON public.tms_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tms_rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  origem_cidade text,
  origem_uf text,
  destino_cidade text,
  destino_uf text,
  distancia_km numeric,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tms_rotas_codigo_uidx ON public.tms_rotas (lower(codigo));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_rotas TO authenticated;
GRANT ALL ON public.tms_rotas TO service_role;
ALTER TABLE public.tms_rotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tms_rotas_auth_all ON public.tms_rotas;
CREATE POLICY tms_rotas_auth_all ON public.tms_rotas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tms_tabela_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.tms_tabela_frete(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'adicional',
  modo text NOT NULL,
  valor numeric,
  unidade text,
  base_calculo text NOT NULL DEFAULT 'nenhuma',
  servico_id uuid REFERENCES public.tms_servicos(id) ON DELETE SET NULL,
  rota_id uuid REFERENCES public.tms_rotas(id) ON DELETE SET NULL,
  faixa_campo text,
  faixa_min numeric,
  faixa_max numeric,
  valor_minimo numeric,
  valor_maximo numeric,
  ordem integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tms_tabela_regras_modo_chk CHECK (modo IN ('valor_fixo','percentual','por_kg','por_m3','por_km','por_volume','faixa','minimo')),
  CONSTRAINT tms_tabela_regras_base_chk CHECK (base_calculo IN ('nenhuma','valor_nota','valor_frete','subtotal','peso','peso_taxado','cubagem','volumes','distancia'))
);
CREATE INDEX IF NOT EXISTS tms_tabela_regras_tabela_idx ON public.tms_tabela_regras (tabela_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_tabela_regras TO authenticated;
GRANT ALL ON public.tms_tabela_regras TO service_role;
ALTER TABLE public.tms_tabela_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tms_tabela_regras_auth_all ON public.tms_tabela_regras;
CREATE POLICY tms_tabela_regras_auth_all ON public.tms_tabela_regras FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tms_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tms_servicos_touch ON public.tms_servicos;
CREATE TRIGGER tms_servicos_touch BEFORE UPDATE ON public.tms_servicos FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();
DROP TRIGGER IF EXISTS tms_rotas_touch ON public.tms_rotas;
CREATE TRIGGER tms_rotas_touch BEFORE UPDATE ON public.tms_rotas FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();
DROP TRIGGER IF EXISTS tms_tabela_regras_touch ON public.tms_tabela_regras;
CREATE TRIGGER tms_tabela_regras_touch BEFORE UPDATE ON public.tms_tabela_regras FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- Migração dos dados legados: cada tabela existente vira um conjunto de regras equivalentes.
INSERT INTO public.tms_tabela_regras (tabela_id, nome, tipo, modo, valor, unidade, base_calculo, faixa_campo, faixa_min, faixa_max, ordem, config)
SELECT t.id, 'Frete por peso', 'frete', 'por_kg', t.valor_kg, 'kg', 'peso_taxado',
       CASE WHEN t.faixa_peso_min IS NOT NULL OR t.faixa_peso_max IS NOT NULL THEN 'peso_taxado' END,
       t.faixa_peso_min, t.faixa_peso_max, 10, jsonb_build_object('legado', true)
FROM public.tms_tabela_frete t
WHERE t.tipo_cobranca IN ('peso','mista','maior')
  AND NOT EXISTS (SELECT 1 FROM public.tms_tabela_regras r WHERE r.tabela_id = t.id);

INSERT INTO public.tms_tabela_regras (tabela_id, nome, tipo, modo, valor, unidade, base_calculo, faixa_campo, faixa_min, faixa_max, ordem, config)
SELECT t.id, 'Frete por cubagem', 'frete', 'por_m3', t.valor_m3, 'm3', 'cubagem',
       CASE WHEN t.faixa_cubagem_min IS NOT NULL OR t.faixa_cubagem_max IS NOT NULL THEN 'cubagem' END,
       t.faixa_cubagem_min, t.faixa_cubagem_max, 20, jsonb_build_object('legado', true)
FROM public.tms_tabela_frete t
WHERE t.tipo_cobranca IN ('cubagem','mista','maior')
  AND NOT EXISTS (SELECT 1 FROM public.tms_tabela_regras r WHERE r.tabela_id = t.id AND r.modo = 'por_m3');

INSERT INTO public.tms_tabela_regras (tabela_id, nome, tipo, modo, valor, base_calculo, ordem, config)
SELECT t.id, 'Taxa de coleta', 'taxa', 'valor_fixo', t.valor_coleta, 'nenhuma', 50, jsonb_build_object('legado', true)
FROM public.tms_tabela_frete t
WHERE NOT EXISTS (SELECT 1 FROM public.tms_tabela_regras r WHERE r.tabela_id = t.id AND r.nome = 'Taxa de coleta');

INSERT INTO public.tms_tabela_regras (tabela_id, nome, tipo, modo, valor, base_calculo, ordem, config)
SELECT t.id, 'Taxa de entrega', 'taxa', 'valor_fixo', t.valor_entrega, 'nenhuma', 60, jsonb_build_object('legado', true)
FROM public.tms_tabela_frete t
WHERE NOT EXISTS (SELECT 1 FROM public.tms_tabela_regras r WHERE r.tabela_id = t.id AND r.nome = 'Taxa de entrega');

INSERT INTO public.tms_tabela_regras (tabela_id, nome, tipo, modo, valor, base_calculo, ordem, config)
SELECT t.id, 'Frete mínimo', 'minimo', 'minimo', t.valor_minimo, 'nenhuma', 900, jsonb_build_object('legado', true)
FROM public.tms_tabela_frete t
WHERE NOT EXISTS (SELECT 1 FROM public.tms_tabela_regras r WHERE r.tabela_id = t.id AND r.modo = 'minimo');
