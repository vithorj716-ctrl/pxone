import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tms")({
  head: () => ({ meta: [{ title: "PXLog — Transfer Hub" }] }),
  component: () => <Outlet />,
});
