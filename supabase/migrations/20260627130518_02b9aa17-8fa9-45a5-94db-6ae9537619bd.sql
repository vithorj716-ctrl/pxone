
-- Sequência numeração de rotas
CREATE SEQUENCE IF NOT EXISTS public.tms_lm_rota_numero_seq START 1000;

-- Motoristas
CREATE TABLE public.tms_lm_motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  nome text NOT NULL,
  cpf text,
  cnh text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_motoristas TO authenticated;
GRANT ALL ON public.tms_lm_motoristas TO service_role;
ALTER TABLE public.tms_lm_motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm motoristas access" ON public.tms_lm_motoristas FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Veiculos
CREATE TABLE public.tms_lm_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  placa text NOT NULL,
  modelo text,
  capacidade_kg numeric NOT NULL DEFAULT 0,
  capacidade_m3 numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_veiculos TO authenticated;
GRANT ALL ON public.tms_lm_veiculos TO service_role;
ALTER TABLE public.tms_lm_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm veiculos access" ON public.tms_lm_veiculos FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Rotas
CREATE TABLE public.tms_lm_rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.tms_lm_rota_numero_seq'),
  empresa_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  motorista_id uuid REFERENCES public.tms_lm_motoristas(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.tms_lm_veiculos(id) ON DELETE SET NULL,
  cidade text,
  status text NOT NULL DEFAULT 'planejada', -- planejada|separando|carregando|em_rota|finalizada|atrasada|ocorrencia
  hora_saida timestamptz,
  hora_prevista timestamptz,
  hora_finalizada timestamptz,
  valor_rota numeric NOT NULL DEFAULT 0,
  faturavel boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tms_lm_rotas_status_idx ON public.tms_lm_rotas(status);
CREATE INDEX tms_lm_rotas_data_idx ON public.tms_lm_rotas(data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_rotas TO authenticated;
GRANT ALL ON public.tms_lm_rotas TO service_role;
GRANT USAGE ON SEQUENCE public.tms_lm_rota_numero_seq TO authenticated, service_role;
ALTER TABLE public.tms_lm_rotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm rotas access" ON public.tms_lm_rotas FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Entregas
CREATE TABLE public.tms_lm_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid REFERENCES public.tms_lm_rotas(id) ON DELETE CASCADE,
  minuta_id uuid REFERENCES public.tms_minutas(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.tms_clientes(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  telefone text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  lat numeric,
  lng numeric,
  qtd_volumes integer NOT NULL DEFAULT 1,
  peso numeric NOT NULL DEFAULT 0,
  cubagem numeric NOT NULL DEFAULT 0,
  valor_mercadoria numeric NOT NULL DEFAULT 0,
  prioridade text NOT NULL DEFAULT 'media', -- baixa|media|alta|urgente
  janela_inicio timestamptz,
  janela_fim timestamptz,
  observacoes text,
  status text NOT NULL DEFAULT 'aguardando_separacao',
  ordem integer NOT NULL DEFAULT 0,
  tempo_estimado_min integer,
  distancia_km numeric,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tms_lm_entregas_rota_idx ON public.tms_lm_entregas(rota_id);
CREATE INDEX tms_lm_entregas_status_idx ON public.tms_lm_entregas(status);
CREATE INDEX tms_lm_entregas_minuta_idx ON public.tms_lm_entregas(minuta_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_entregas TO authenticated;
GRANT ALL ON public.tms_lm_entregas TO service_role;
ALTER TABLE public.tms_lm_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm entregas access" ON public.tms_lm_entregas FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Volumes
CREATE TABLE public.tms_lm_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.tms_lm_entregas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_separacao',
  separado_em timestamptz,
  carregado_em timestamptz,
  entregue_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tms_lm_volumes_entrega_idx ON public.tms_lm_volumes(entrega_id);
CREATE INDEX tms_lm_volumes_codigo_idx ON public.tms_lm_volumes(codigo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_volumes TO authenticated;
GRANT ALL ON public.tms_lm_volumes TO service_role;
ALTER TABLE public.tms_lm_volumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm volumes access" ON public.tms_lm_volumes FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Eventos
CREATE TABLE public.tms_lm_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid REFERENCES public.tms_lm_entregas(id) ON DELETE CASCADE,
  rota_id uuid REFERENCES public.tms_lm_rotas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tms_lm_eventos_entrega_idx ON public.tms_lm_eventos(entrega_id);
CREATE INDEX tms_lm_eventos_created_idx ON public.tms_lm_eventos(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_eventos TO authenticated;
GRANT ALL ON public.tms_lm_eventos TO service_role;
ALTER TABLE public.tms_lm_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm eventos access" ON public.tms_lm_eventos FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Ocorrencias
CREATE TABLE public.tms_lm_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.tms_lm_entregas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- ausente|endereco_incorreto|recusa|avaria|extraviado|parcial|fechado|reagendamento|outros
  descricao text,
  foto_url text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_ocorrencias TO authenticated;
GRANT ALL ON public.tms_lm_ocorrencias TO service_role;
ALTER TABLE public.tms_lm_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm ocorrencias access" ON public.tms_lm_ocorrencias FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Comprovantes (POD)
CREATE TABLE public.tms_lm_comprovantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.tms_lm_entregas(id) ON DELETE CASCADE,
  recebedor_nome text,
  recebedor_doc text,
  foto_mercadoria text,
  foto_fachada text,
  assinatura_base64 text,
  observacoes text,
  lat numeric,
  lng numeric,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tms_lm_comprovantes_entrega_idx ON public.tms_lm_comprovantes(entrega_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_lm_comprovantes TO authenticated;
GRANT ALL ON public.tms_lm_comprovantes TO service_role;
ALTER TABLE public.tms_lm_comprovantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm comprovantes access" ON public.tms_lm_comprovantes FOR ALL TO authenticated
  USING (public.has_system_access(auth.uid(), 'pxlog-tms'))
  WITH CHECK (public.has_system_access(auth.uid(), 'pxlog-tms'));

-- Triggers updated_at
CREATE TRIGGER tms_lm_motoristas_uat BEFORE UPDATE ON public.tms_lm_motoristas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tms_lm_veiculos_uat BEFORE UPDATE ON public.tms_lm_veiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tms_lm_rotas_uat BEFORE UPDATE ON public.tms_lm_rotas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tms_lm_entregas_uat BEFORE UPDATE ON public.tms_lm_entregas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
