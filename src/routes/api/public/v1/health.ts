// PX API — Health check público (sem autenticação).
import { createFileRoute } from "@tanstack/react-router";
import { pxOk, methodNotAllowed, getRequestId } from "@/px-api/envelope";

export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return pxOk(
          { service: "px-api", version: "v1", uptime: "ok" },
          { message: "PX API operacional", requestId: getRequestId(request) },
        );
      },
      POST: async ({ request }) => methodNotAllowed(["GET"], getRequestId(request)),
    },
  },
});
