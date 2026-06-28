
-- Fase A: cadastros de suporte para Nova Solicitação

-- 1. Campos comerciais no cliente
ALTER TABLE public.px_registry_clientes
  ADD COLUMN IF NOT EXISTS tabela_frete_id uuid,
  ADD COLUMN IF NOT EXISTS prazo_padrao_dias integer,
  ADD COLUMN IF NOT EXISTS observacoes_comerciais text;

-- 2. Endereços do cliente (múltiplos)
CREATE TABLE IF NOT EXISTS public.px_registry_enderecos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outro',
  apelido text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  ponto_referencia text,
  observacoes text,
  janela_recebimento text,
  restricoes text[] NOT NULL DEFAULT '{}',
  is_padrao_remetente boolean NOT NULL DEFAULT false,
  is_padrao_destinatario boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_registry_enderecos TO authenticated;
GRANT ALL ON public.px_registry_enderecos TO service_role;

ALTER TABLE public.px_registry_enderecos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enderecos_select_auth" ON public.px_registry_enderecos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "enderecos_insert_auth" ON public.px_registry_enderecos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "enderecos_update_auth" ON public.px_registry_enderecos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "enderecos_delete_auth" ON public.px_registry_enderecos
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS px_registry_enderecos_cliente_idx
  ON public.px_registry_enderecos(cliente_id);

CREATE TRIGGER set_px_registry_enderecos_updated_at
  BEFORE UPDATE ON public.px_registry_enderecos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Contatos do endereço (múltiplos por endereço)
CREATE TABLE IF NOT EXISTS public.px_registry_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.px_registry_clientes(id) ON DELETE CASCADE,
  endereco_id uuid REFERENCES public.px_registry_enderecos(id) ON DELETE CASCADE,
  setor text NOT NULL DEFAULT 'outro',
  nome text NOT NULL,
  cargo text,
  telefone text,
  whatsapp text,
  email text,
  is_principal boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.px_registry_contatos TO authenticated;
GRANT ALL ON public.px_registry_contatos TO service_role;

ALTER TABLE public.px_registry_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatos_select_auth" ON public.px_registry_contatos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_insert_auth" ON public.px_registry_contatos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_update_auth" ON public.px_registry_contatos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contatos_delete_auth" ON public.px_registry_contatos
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS px_registry_contatos_cliente_idx
  ON public.px_registry_contatos(cliente_id);
CREATE INDEX IF NOT EXISTS px_registry_contatos_endereco_idx
  ON public.px_registry_contatos(endereco_id);

CREATE TRIGGER set_px_registry_contatos_updated_at
  BEFORE UPDATE ON public.px_registry_contatos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Backfill: 1 endereço "Matriz" por cliente existente
INSERT INTO public.px_registry_enderecos
  (cliente_id, tipo, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf,
   is_padrao_remetente, is_padrao_destinatario, created_by, updated_by)
SELECT c.id, 'matriz', 'Matriz', c.cep, c.logradouro, c.numero, c.complemento, c.bairro, c.cidade, c.uf,
       true, true, c.created_by, c.updated_by
FROM public.px_registry_clientes c
WHERE NOT EXISTS (SELECT 1 FROM public.px_registry_enderecos e WHERE e.cliente_id = c.id)
  AND (c.cep IS NOT NULL OR c.logradouro IS NOT NULL OR c.cidade IS NOT NULL);

-- 5. Backfill: contato principal a partir de contato_nome
INSERT INTO public.px_registry_contatos
  (cliente_id, endereco_id, setor, nome, cargo, telefone, whatsapp, email, is_principal, created_by, updated_by)
SELECT c.id,
       (SELECT id FROM public.px_registry_enderecos e WHERE e.cliente_id = c.id ORDER BY created_at ASC LIMIT 1),
       'outro',
       c.contato_nome,
       c.contato_cargo,
       c.telefone,
       c.whatsapp,
       c.email,
       true,
       c.created_by, c.updated_by
FROM public.px_registry_clientes c
WHERE c.contato_nome IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.px_registry_contatos k WHERE k.cliente_id = c.id);
