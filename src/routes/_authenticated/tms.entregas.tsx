import { createFileRoute } from "@tanstack/react-router";
import { ScanOperationPage, OPERACOES } from "./tms.conferencia";

export const Route = createFileRoute("/_authenticated/tms/entregas")({
  head: () => ({ meta: [{ title: "PXLog — Entregas" }] }),
  component: () => <ScanOperationPage op={OPERACOES.entrega} extraField={{ label: "Recebedor (nome)", key: "recebedor" }} />,
});
