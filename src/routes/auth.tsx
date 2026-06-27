import { createFileRoute, redirect } from "@tanstack/react-router";

// Compat: tudo /auth → /login (nova PX Identity)
export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/login" }); },
  component: () => null,
});
