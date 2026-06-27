import { createFileRoute } from "@tanstack/react-router";
import { ScanOperationPage, OPERACOES } from "./tms.conferencia";

export const Route = createFileRoute("/_authenticated/tms/recebimento")({
  head: () => ({ meta: [{ title: "PXLog — Recebimento" }] }),
  component: () => <ScanOperationPage op={OPERACOES.recebimento} />,
});
