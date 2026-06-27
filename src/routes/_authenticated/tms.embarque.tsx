import { createFileRoute } from "@tanstack/react-router";
import { ScanOperationPage, OPERACOES } from "./tms.conferencia";

export const Route = createFileRoute("/_authenticated/tms/embarque")({
  head: () => ({ meta: [{ title: "PXLog — Embarque" }] }),
  component: () => <ScanOperationPage op={OPERACOES.embarque} extraField={{ label: "Veículo / Motorista", key: "veiculo" }} />,
});
