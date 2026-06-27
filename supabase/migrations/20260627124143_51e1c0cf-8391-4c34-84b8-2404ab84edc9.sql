
-- ============ PERFIS ============
CREATE TABLE public.px_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.px_perfis TO authenticated;
GRANT ALL ON public.px_perfis TO service_role;
ALTER TABLE public.px_perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read perfis" ON public.px_perfis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Diretor manage perfis" ON public.px_perfis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin') OR public.has_role(auth.uid(), 'socio') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin') OR public.has_role(auth.uid(), 'socio') OR public.has_role(auth.uid(), 'diretor'));

-- ============ PERMISSÕES DOS PERFIS ============
CREATE TABLE public.px_perfil_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.px_perfis(id) ON DELETE CASCADE,
  sistema_key text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('view','create','edit','delete','export','approve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, sistema_key, acao)
);
GRANT SELECT ON public.px_perfil_permissoes TO authenticated;
GRANT ALL ON public.px_perfil_permissoes TO service_role;
ALTER TABLE public.px_perfil_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read permissoes" ON public.px_perfil_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Diretor manage permissoes" ON public.px_perfil_permissoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master_admin') OR public.has_role(auth.uid(), 'socio') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'master_admin') OR public.has_role(auth.uid(), 'socio') OR public.has_role(auth.uid(), 'diretor'));

-- ============ VÍNCULO USUÁRIO ↔ PERFIL ============
CREATE TABLE public.px_usuario_perfis (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.px_perfis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, perfil_id)
);
GRANT SELECT ON public.px_usuario_perfis TO authenticated;
GRANT ALL ON public.px_usuario_perfis TO service_role;
ALTER TABLE public.px_usuario_perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own perfis or admin" ON public.px_usuario_perfis FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_executive(auth.uid()));
CREATE POLICY "Admin manage usuario perfis" ON public.px_usuario_perfis FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

-- ============ ACESSO A SISTEMAS ============
CREATE TABLE public.px_usuario_sistemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sistema_key text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sistema_key)
);
GRANT SELECT, UPDATE ON public.px_usuario_sistemas TO authenticated;
GRANT ALL ON public.px_usuario_sistemas TO service_role;
ALTER TABLE public.px_usuario_sistemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own systems read" ON public.px_usuario_sistemas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_executive(auth.uid()));
CREATE POLICY "Own systems update last access" ON public.px_usuario_sistemas FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin manage systems" ON public.px_usuario_sistemas FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

-- ============ METADADOS DE USUÁRIO ============
CREATE TABLE public.px_usuarios_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login text UNIQUE NOT NULL,
  nome text NOT NULL,
  cargo text,
  situacao text NOT NULL DEFAULT 'ativo',
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.px_usuarios_meta TO authenticated;
GRANT ALL ON public.px_usuarios_meta TO service_role;
ALTER TABLE public.px_usuarios_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own meta read" ON public.px_usuarios_meta FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_executive(auth.uid()));
CREATE POLICY "Own meta update" ON public.px_usuarios_meta FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin manage meta" ON public.px_usuarios_meta FOR ALL TO authenticated
  USING (public.is_executive(auth.uid())) WITH CHECK (public.is_executive(auth.uid()));

-- Triggers de updated_at
CREATE TRIGGER trg_px_perfis_updated BEFORE UPDATE ON public.px_perfis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_px_usuario_sistemas_updated BEFORE UPDATE ON public.px_usuario_sistemas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_px_usuarios_meta_updated BEFORE UPDATE ON public.px_usuarios_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNÇÃO has_system_access ============
CREATE OR REPLACE FUNCTION public.has_system_access(_user_id uuid, _sistema text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_executive(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.px_usuario_sistemas
      WHERE user_id = _user_id AND sistema_key = _sistema AND ativo = true
    );
$$;

-- ============ SEED PERFIS PADRÃO ============
INSERT INTO public.px_perfis (nome, descricao, is_system) VALUES
  ('Diretor Geral', 'Acesso total à plataforma', true),
  ('Diretor', 'Acesso executivo', true),
  ('Gerente', 'Gestão operacional', true),
  ('Financeiro', 'Operações financeiras', true),
  ('Comercial', 'Vendas e clientes', true),
  ('Operacional', 'Execução operacional', true),
  ('Conferente', 'Conferência de cargas', true),
  ('Motorista', 'Operações em campo', true),
  ('Administrador', 'Administração de sistemas', true)
ON CONFLICT (nome) DO NOTHING;

-- Permissões totais para Diretor Geral em todos os sistemas conhecidos
INSERT INTO public.px_perfil_permissoes (perfil_id, sistema_key, acao)
SELECT p.id, s.sistema_key, a.acao
FROM public.px_perfis p
CROSS JOIN (VALUES ('pxone-erp'),('pxlog-tms'),('pxmed'),('pxfarma')) AS s(sistema_key)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete'),('export'),('approve')) AS a(acao)
WHERE p.nome = 'Diretor Geral'
ON CONFLICT DO NOTHING;

-- ============ SEED USUÁRIO vithorb (Diretor Geral) ============
DO $$
DECLARE
  v_uid uuid;
  v_perfil_id uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'vithorb@px.local';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', 'vithorb@px.local',
      crypt('202406', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('login','vithorb','full_name','Vithor B'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email','vithorb@px.local'),
      'email', v_uid::text, now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, display_name) VALUES (v_uid, 'Vithor B')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'master_admin')
    ON CONFLICT DO NOTHING;

  INSERT INTO public.px_usuarios_meta (user_id, login, nome, cargo, situacao)
  VALUES (v_uid, 'vithorb', 'Vithor B', 'Diretor Geral', 'ativo')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_perfil_id FROM public.px_perfis WHERE nome = 'Diretor Geral';
  IF v_perfil_id IS NOT NULL THEN
    INSERT INTO public.px_usuario_perfis (user_id, perfil_id) VALUES (v_uid, v_perfil_id)
      ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.px_usuario_sistemas (user_id, sistema_key, ativo)
  VALUES (v_uid, 'pxone-erp', true), (v_uid, 'pxlog-tms', true)
  ON CONFLICT DO NOTHING;
END $$;
