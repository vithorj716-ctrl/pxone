import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Modo Corporativo Interno: sem tela de login.
// Garante uma sessão interna silenciosa para que o RLS continue funcionando.
const INTERNAL_EMAIL = "emissao@pxlog.com.br";
const INTERNAL_PASSWORD = "Tomate26@";

async function ensureInternalSession() {
  const { data } = await supabase.auth.getUser();
  if (data.user) return;
  const { error } = await supabase.auth.signInWithPassword({
    email: INTERNAL_EMAIL,
    password: INTERNAL_PASSWORD,
  });
  if (error) {
    // Conta interna ainda não existe — cria silenciosamente.
    await supabase.auth.signUp({ email: INTERNAL_EMAIL, password: INTERNAL_PASSWORD });
    await supabase.auth.signInWithPassword({ email: INTERNAL_EMAIL, password: INTERNAL_PASSWORD });
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await ensureInternalSession();
    const { data } = await supabase.auth.getUser();
    return { user: data.user };
  },
  component: () => <Outlet />,
});
