CREATE TABLE public.pxsales_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  arquivo_nome text NOT NULL,
  arquivo_hash text NOT NULL,
  origem text,
  versao text,
  observacao text,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_registros integer NOT NULL DEFAULT 0,
  criados integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  revisao integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando','concluida','cancelada')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pxsales_importacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.pxsales_importacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  xml_id text NOT NULL,
  xml_ids text[] NOT NULL DEFAULT '{}'::text[],
  registro_hash text NOT NULL,
  cnpj text,
  cnpjs text[] NOT NULL DEFAULT '{}'::text[],
  empresa_nome text,
  acao text NOT NULL DEFAULT 'revisao' CHECK (acao IN ('criar','atualizar','lead','revisao','ignorar')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ok','erro','ignorado','revisao')),
  cliente_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.pxsales_leads(id) ON DELETE SET NULL,
  mensagem text,
  campos jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflitos jsonb NOT NULL DEFAULT '[]'::jsonb,
  enriquecido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (importacao_id, xml_id)
);

CREATE INDEX idx_pxsales_importacoes_empresa ON public.pxsales_importacoes (empresa_id, created_at DESC);
CREATE INDEX idx_pxsales_importacoes_hash ON public.pxsales_importacoes (empresa_id, arquivo_hash);
CREATE INDEX idx_pxsales_imp_itens_imp ON public.pxsales_importacao_itens (importacao_id);
CREATE INDEX idx_pxsales_imp_itens_hash ON public.pxsales_importacao_itens (empresa_id, registro_hash) WHERE status = 'ok';
CREATE INDEX idx_pxsales_imp_itens_cnpj ON public.pxsales_importacao_itens (empresa_id, cnpj);

GRANT SELECT, INSERT, UPDATE ON public.pxsales_importacoes TO authenticated;
GRANT ALL ON public.pxsales_importacoes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.pxsales_importacao_itens TO authenticated;
GRANT ALL ON public.pxsales_importacao_itens TO service_role;

ALTER TABLE public.pxsales_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pxsales_importacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "importacoes visiveis por empresa" ON public.pxsales_importacoes
  FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.clientes.view', empresa_id));

CREATE POLICY "importacoes gravadas por quem importa" ON public.pxsales_importacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.clientes.import', empresa_id));

CREATE POLICY "importacoes atualizadas por quem importa" ON public.pxsales_importacoes
  FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.clientes.import', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.clientes.import', empresa_id));

CREATE POLICY "itens visiveis por empresa" ON public.pxsales_importacao_itens
  FOR SELECT TO authenticated
  USING (public.pxsales_can('pxsales.clientes.view', empresa_id));

CREATE POLICY "itens gravados por quem importa" ON public.pxsales_importacao_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.pxsales_can('pxsales.clientes.import', empresa_id));

CREATE POLICY "itens atualizados por quem importa" ON public.pxsales_importacao_itens
  FOR UPDATE TO authenticated
  USING (public.pxsales_can('pxsales.clientes.import', empresa_id))
  WITH CHECK (public.pxsales_can('pxsales.clientes.import', empresa_id));

CREATE TRIGGER trg_pxsales_importacoes_updated BEFORE UPDATE ON public.pxsales_importacoes
  FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();
CREATE TRIGGER trg_pxsales_imp_itens_updated BEFORE UPDATE ON public.pxsales_importacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

INSERT INTO public.px_perfil_permissoes (perfil_id, sistema_key, acao)
SELECT p.id, 'pxsales', 'pxsales.clientes.import'
FROM public.px_perfis p
WHERE EXISTS (
  SELECT 1 FROM public.px_perfil_permissoes pp
  WHERE pp.perfil_id = p.id AND pp.sistema_key = 'pxsales' AND pp.acao = 'pxsales.clientes.edit'
)
ON CONFLICT DO NOTHING;