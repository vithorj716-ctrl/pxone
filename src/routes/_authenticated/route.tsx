import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// PX Platform — exige sessão. Sem auto-login: a tela /login é responsável.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login" });
    }
    // Ao entrar diretamente em "/" (raiz) sem sistema escolhido, manda ao Launcher.
    if (location.pathname === "/") {
      let active: string | null = null;
      try { active = sessionStorage.getItem("px:active-system"); } catch {}
      if (!active) throw redirect({ to: "/launcher" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
