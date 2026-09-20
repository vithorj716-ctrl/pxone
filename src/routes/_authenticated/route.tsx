import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// PX Platform — exige sessão. Sem auto-login: a tela /login é responsável.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staleTime: 30_000,
  beforeLoad: async ({ location }) => {
    // A sessão já é validada nas operações protegidas. Ler o estado local (com
    // cache curto em memória) evita qualquer espera a cada clique do menu.
    const data = await getCachedSession();
    if (!data.session?.user) {
      throw redirect({ to: "/login" });
    }
    // Ao entrar diretamente em "/" (raiz) sem sistema escolhido, manda ao Launcher.
    if (location.pathname === "/") {
      let active: string | null = null;
      try { active = sessionStorage.getItem("px:active-system"); } catch {}
      if (!active) throw redirect({ to: "/launcher" });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});

// Cache curto da sessão local para transições instantâneas entre telas.
let sessionCache: { at: number; value: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"] } | null = null;

async function getCachedSession() {
  const now = Date.now();
  if (sessionCache && now - sessionCache.at < 15_000) return sessionCache.value;
  const { data } = await supabase.auth.getSession();
  sessionCache = { at: now, value: data };
  return data;
}
