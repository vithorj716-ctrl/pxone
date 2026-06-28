
-- PX Registry: cadastro único de clientes por CNPJ
CREATE TABLE public.px_registry_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  razao_social text,
  nome_fantasia text,
  situacao_cadastral text,
  data_abertura date,
  natureza_juridica text,
  cnae_principal text,
  cnae_descricao text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  contato_nome text,
  contato_cargo text,
  telefone text,
  whatsapp text,
  email text,
  observacoes text,
  condicao_pagamento text,
  tabela_frete_id uuid,
  limite_credito numeric(14,2),
  categorias text[] NOT NULL DEFAULT '{}',
  api_payload jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT px_registry_clientes_cnpj_digits CHECK (cnpj ~ '^[0-9]{14}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_registry_clientes TO authenticated;
GRANT ALL ON public.px_registry_clientes TO service_role;

ALTER TABLE public.px_registry_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read clientes"
  ON public.px_registry_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert clientes"
  ON public.px_registry_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update clientes"
  ON public.px_registry_clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "executive delete clientes"
  ON public.px_registry_clientes FOR DELETE TO authenticated USING (public.is_executive(auth.uid()));

CREATE INDEX idx_px_registry_clientes_cnpj ON public.px_registry_clientes(cnpj);
CREATE INDEX idx_px_registry_clientes_categorias ON public.px_registry_clientes USING gin(categorias);

CREATE TRIGGER trg_px_registry_clientes_updated_at
  BEFORE UPDATE ON public.px_registry_clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculos por sistema da plataforma
CREATE TABLE public.px_registry_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  sistema_key text NOT NULL,
  vinculado_por uuid,
  vinculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, sistema_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_registry_vinculos TO authenticated;
GRANT ALL ON public.px_registry_vinculos TO service_role;

ALTER TABLE public.px_registry_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated manage vinculos"
  ON public.px_registry_vinculos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_px_registry_vinculos_cliente ON public.px_registry_vinculos(cliente_id);
CREATE INDEX idx_px_registry_vinculos_sistema ON public.px_registry_vinculos(sistema_key);

-- Compatibilidade com tms_clientes legado
ALTER TABLE public.tms_clientes
  ADD COLUMN IF NOT EXISTS registry_id uuid REFERENCES public.px_registry_clientes(id) ON DELETE SET NULL;
