
-- Enum de eventos
DO $$ BEGIN
  CREATE TYPE public.tms_evento_tipo AS ENUM (
    'solicitado','coleta_programada','coletado','recebido_hub_origem','conferido','etiquetado',
    'embarcado','em_transferencia','recebido_hub_destino','separado','em_rota','saiu_entrega',
    'entregue','ocorrencia','devolucao'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sequência para numero da minuta
CREATE SEQUENCE IF NOT EXISTS public.tms_minuta_numero_seq START 1000;

-- Clientes TMS
CREATE TABLE IF NOT EXISTS public.tms_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cnpj text,
  contato text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_clientes TO authenticated;
GRANT ALL ON public.tms_clientes TO service_role;
ALTER TABLE public.tms_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_clientes_auth_all" ON public.tms_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tms_clientes_updated BEFORE UPDATE ON public.tms_clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de Frete
CREATE TABLE IF NOT EXISTS public.tms_tabela_frete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.tms_clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  origem text,
  destino text,
  tipo_cobranca text NOT NULL DEFAULT 'peso',
  valor_coleta numeric NOT NULL DEFAULT 0,
  valor_entrega numeric NOT NULL DEFAULT 0,
  valor_kg numeric NOT NULL DEFAULT 0,
  valor_m3 numeric NOT NULL DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,
  faixa_peso_min numeric,
  faixa_peso_max numeric,
  faixa_cubagem_min numeric,
  faixa_cubagem_max numeric,
  prazo_dias int NOT NULL DEFAULT 1,
  regra jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_tabela_frete TO authenticated;
GRANT ALL ON public.tms_tabela_frete TO service_role;
ALTER TABLE public.tms_tabela_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_tabela_frete_auth_all" ON public.tms_tabela_frete FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tms_tabela_frete_updated BEFORE UPDATE ON public.tms_tabela_frete FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Minutas
CREATE TABLE IF NOT EXISTS public.tms_minutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.tms_minuta_numero_seq') UNIQUE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.tms_clientes(id) ON DELETE SET NULL,
  remetente jsonb NOT NULL DEFAULT '{}'::jsonb,
  destinatario jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL,
  destino text NOT NULL,
  qtd_volumes int NOT NULL DEFAULT 1,
  peso numeric NOT NULL DEFAULT 0,
  cubagem numeric NOT NULL DEFAULT 0,
  peso_cubado numeric NOT NULL DEFAULT 0,
  peso_taxado numeric NOT NULL DEFAULT 0,
  valor_mercadoria numeric NOT NULL DEFAULT 0,
  tipo_mercadoria text,
  valor_frete numeric NOT NULL DEFAULT 0,
  prazo_dias int NOT NULL DEFAULT 1,
  necessita_coleta boolean NOT NULL DEFAULT false,
  data_coleta date,
  janela_atendimento text,
  status text NOT NULL DEFAULT 'solicitado',
  status_financeiro text NOT NULL DEFAULT 'previsto',
  responsavel_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_minutas TO authenticated;
GRANT ALL ON public.tms_minutas TO service_role;
ALTER TABLE public.tms_minutas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_minutas_auth_all" ON public.tms_minutas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tms_minutas_updated BEFORE UPDATE ON public.tms_minutas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tms_minutas_numero_idx ON public.tms_minutas(numero);
CREATE INDEX IF NOT EXISTS tms_minutas_status_idx ON public.tms_minutas(status);
CREATE INDEX IF NOT EXISTS tms_minutas_cliente_idx ON public.tms_minutas(cliente_id);

-- Volumes
CREATE TABLE IF NOT EXISTS public.tms_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid NOT NULL REFERENCES public.tms_minutas(id) ON DELETE CASCADE,
  numero int NOT NULL,
  codigo text NOT NULL UNIQUE,
  peso numeric NOT NULL DEFAULT 0,
  altura numeric,
  largura numeric,
  comprimento numeric,
  status text NOT NULL DEFAULT 'solicitado',
  hub_atual text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_volumes TO authenticated;
GRANT ALL ON public.tms_volumes TO service_role;
ALTER TABLE public.tms_volumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_volumes_auth_all" ON public.tms_volumes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tms_volumes_updated BEFORE UPDATE ON public.tms_volumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tms_volumes_minuta_idx ON public.tms_volumes(minuta_id);
CREATE INDEX IF NOT EXISTS tms_volumes_codigo_idx ON public.tms_volumes(codigo);

-- Eventos
CREATE TABLE IF NOT EXISTS public.tms_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid REFERENCES public.tms_minutas(id) ON DELETE CASCADE,
  volume_id uuid REFERENCES public.tms_volumes(id) ON DELETE CASCADE,
  tipo public.tms_evento_tipo NOT NULL,
  origem_evento text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  operador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_eventos TO authenticated;
GRANT ALL ON public.tms_eventos TO service_role;
ALTER TABLE public.tms_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_eventos_auth_all" ON public.tms_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS tms_eventos_minuta_idx ON public.tms_eventos(minuta_id);
CREATE INDEX IF NOT EXISTS tms_eventos_volume_idx ON public.tms_eventos(volume_id);
CREATE INDEX IF NOT EXISTS tms_eventos_created_idx ON public.tms_eventos(created_at DESC);
