import { createFileRoute, redirect } from "@tanstack/react-router";

// Modo Corporativo Interno: tela de login removida.
// Qualquer acesso a /auth é redirecionado direto para o Executive Command.
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
