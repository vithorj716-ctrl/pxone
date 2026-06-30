// PX API — Documentação interativa (Swagger UI) consumindo /api/public/v1/openapi.json
//
// Rota protegida: apenas executivos podem visualizar.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/px-api/docs")({
  component: PxApiDocsPage,
});

function PxApiDocsPage() {
  const srcDoc = useMemo(
    () => `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>PX API · Documentação</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    html, body { margin:0; padding:0; background:#0b0b0c; }
    body { color:#e5e7eb; }
    #swagger-ui { padding: 12px; }
    .swagger-ui .topbar { display:none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.addEventListener('load', function () {
      window.ui = SwaggerUIBundle({
        url: '/api/public/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        defaultModelsExpandDepth: 0,
        persistAuthorization: true,
        tryItOutEnabled: true,
        layout: 'BaseLayout',
      });
    });
  </script>
</body>
</html>`,
    [],
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">PX API · Documentação interativa</h1>
          <p className="text-xs text-muted-foreground">
            Especificação OpenAPI 3.1 carregada de{" "}
            <code className="text-[11px]">/api/public/v1/openapi.json</code>.
          </p>
        </div>
        <a
          href="/api/public/v1/openapi.json"
          target="_blank"
          rel="noreferrer"
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          Baixar openapi.json
        </a>
      </div>
      <iframe
        title="PX API Docs"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
