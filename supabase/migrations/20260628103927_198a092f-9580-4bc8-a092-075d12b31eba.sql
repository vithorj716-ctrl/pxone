
-- Viagens (entidade central do embarque)
CREATE TABLE public.tms_viagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  codigo text NOT NULL UNIQUE,
  origem text NOT NULL,
  destino text NOT NULL,
  rota text,
  motorista_id uuid REFERENCES public.tms_lm_motoristas(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.tms_lm_veiculos(id) ON DELETE SET NULL,
  placa text,
  motorista_nome text,
  status text NOT NULL DEFAULT 'planejada',
  data_prevista timestamptz,
  iniciada_em timestamptz,
  finalizada_em timestamptz,
  operador_id uuid,
  qtd_volumes_prev integer NOT NULL DEFAULT 0,
  peso_prev numeric NOT NULL DEFAULT 0,
  cubagem_prev numeric NOT NULL DEFAULT 0,
  qtd_volumes_emb integer NOT NULL DEFAULT 0,
  peso_emb numeric NOT NULL DEFAULT 0,
  tempo_operacao_min integer,
  observacoes text,
  resumo jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_viagens TO authenticated;
GRANT ALL ON public.tms_viagens TO service_role;
ALTER TABLE public.tms_viagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_viagens_auth_all" ON public.tms_viagens TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tms_viagens_updated BEFORE UPDATE ON public.tms_viagens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tms_viagens_status_idx ON public.tms_viagens(status);
CREATE INDEX tms_viagens_codigo_idx ON public.tms_viagens(codigo);

-- Sequência para gerar código GOI-00001
CREATE SEQUENCE IF NOT EXISTS public.tms_viagem_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.tms_viagem_seq TO authenticated;

-- Vínculo viagem ↔ minuta
CREATE TABLE public.tms_viagem_minutas (
  viagem_id uuid NOT NULL REFERENCES public.tms_viagens(id) ON DELETE CASCADE,
  minuta_id uuid NOT NULL REFERENCES public.tms_minutas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viagem_id, minuta_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_viagem_minutas TO authenticated;
GRANT ALL ON public.tms_viagem_minutas TO service_role;
ALTER TABLE public.tms_viagem_minutas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_viagem_minutas_auth_all" ON public.tms_viagem_minutas TO authenticated USING (true) WITH CHECK (true);

-- Eventos / auditoria da viagem (bips OK, divergências, finalizações, resumos)
CREATE TABLE public.tms_viagem_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.tms_viagens(id) ON DELETE CASCADE,
  volume_id uuid REFERENCES public.tms_volumes(id) ON DELETE SET NULL,
  codigo text,
  tipo text NOT NULL, -- bip_ok | bip_erro | iniciada | finalizada | volume_pendente | resumo
  motivo text,        -- razão do erro / motivo
  operador_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_viagem_eventos TO authenticated;
GRANT ALL ON public.tms_viagem_eventos TO service_role;
ALTER TABLE public.tms_viagem_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_viagem_eventos_auth_all" ON public.tms_viagem_eventos TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX tms_viagem_eventos_viagem_idx ON public.tms_viagem_eventos(viagem_id);
CREATE INDEX tms_viagem_eventos_created_idx ON public.tms_viagem_eventos(created_at DESC);

-- Cancelamentos (auditoria — nunca exclui)
CREATE TABLE public.tms_cancelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minuta_id uuid REFERENCES public.tms_minutas(id) ON DELETE CASCADE,
  viagem_id uuid REFERENCES public.tms_viagens(id) ON DELETE SET NULL,
  volume_id uuid REFERENCES public.tms_volumes(id) ON DELETE SET NULL,
  escopo text NOT NULL, -- minuta | volume | viagem
  motivo text NOT NULL,
  motivo_texto text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tms_cancelamentos TO authenticated;
GRANT ALL ON public.tms_cancelamentos TO service_role;
ALTER TABLE public.tms_cancelamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tms_cancelamentos_auth_all" ON public.tms_cancelamentos TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX tms_cancelamentos_minuta_idx ON public.tms_cancelamentos(minuta_id);

-- Colunas em minutas (cancelamento)
ALTER TABLE public.tms_minutas
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid;

-- Colunas em volumes (vinculação à viagem, embarque e bloqueio)
ALTER TABLE public.tms_volumes
  ADD COLUMN IF NOT EXISTS viagem_id uuid REFERENCES public.tms_viagens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS embarcado_em timestamptz,
  ADD COLUMN IF NOT EXISTS embarcado_por uuid,
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueio_motivo text;

CREATE INDEX IF NOT EXISTS tms_volumes_viagem_idx ON public.tms_volumes(viagem_id);
