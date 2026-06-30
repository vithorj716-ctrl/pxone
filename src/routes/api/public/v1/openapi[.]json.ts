// PX API — GET /api/public/v1/openapi.json
// Especificação OpenAPI 3.1 da PX API. Endpoint público (sem auth) —
// usado pelo painel /admin/px-api/docs e por consumidores externos.

import { createFileRoute } from "@tanstack/react-router";

const SCOPES = {
  "clientes:read": "Ler clientes, endereços, contatos e lançamentos",
  "clientes:write": "Criar/atualizar/inativar clientes",
  "enderecos:write": "Gerenciar endereços de clientes",
  "contatos:write": "Gerenciar contatos de clientes",
  "financeiro:read": "Ler conta corrente do cliente",
  "empresas:read": "Ler empresas e filiais do grupo",
  "usuarios:read": "Ler usuários da plataforma",
  "perfis:read": "Ler perfis e permissões",
  "tabela-frete:read": "Ler tabelas de frete",
};

function buildSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "PX API",
      version: "1.0.0",
      description:
        "Núcleo de integração da PX Platform. Toda informação compartilhada do PXOne é exposta aqui e consumida pelos demais sistemas (PXLog, PXComercial, PXMed, PXFarma, ...).",
    },
    servers: [{ url: `${origin}/api/public/v1`, description: "PX API v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Envelope: {
          type: "object",
          required: ["status", "message", "timestamp", "requestId"],
          properties: {
            status: { type: "string", enum: ["ok", "error"] },
            message: { type: "string" },
            data: {},
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
            code: { type: "string" },
          },
        },
        PageMeta: {
          type: "object",
          properties: {
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            hasMore: { type: "boolean" },
          },
        },
        Cliente: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            cnpj: { type: "string" },
            razao_social: { type: "string" },
            nome_fantasia: { type: "string", nullable: true },
            situacao_cadastral: { type: "string", nullable: true },
            cep: { type: "string", nullable: true },
            logradouro: { type: "string", nullable: true },
            numero: { type: "string", nullable: true },
            complemento: { type: "string", nullable: true },
            bairro: { type: "string", nullable: true },
            cidade: { type: "string", nullable: true },
            uf: { type: "string", nullable: true },
            telefone: { type: "string", nullable: true },
            email: { type: "string", nullable: true },
            categorias: { type: "array", items: { type: "string" } },
            ativo: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Endereco: { type: "object", additionalProperties: true },
        Contato: { type: "object", additionalProperties: true },
        Empresa: { type: "object", additionalProperties: true },
        Filial: { type: "object", additionalProperties: true },
        Perfil: { type: "object", additionalProperties: true },
        Usuario: { type: "object", additionalProperties: true },
        TabelaFrete: { type: "object", additionalProperties: true },
        Lancamento: { type: "object", additionalProperties: true },
        ContaCorrente: { type: "object", additionalProperties: true },
      },
      parameters: {
        Page: { in: "query", name: "page", schema: { type: "integer", default: 1 } },
        PageSize: { in: "query", name: "pageSize", schema: { type: "integer", default: 25, maximum: 200 } },
        Search: { in: "query", name: "search", schema: { type: "string" } },
        IdempotencyKey: { in: "header", name: "Idempotency-Key", schema: { type: "string" }, description: "UUID opcional para garantir idempotência de POSTs (24h)." },
      },
      responses: {
        Unauthorized: { description: "Token ausente, inválido ou revogado.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        Forbidden: { description: "Escopos insuficientes.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        NotFound: { description: "Recurso não encontrado.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        ValidationError: { description: "Body ou parâmetros inválidos.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        RateLimited: { description: "Limite de requisições por minuto excedido.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Auth" },
      { name: "Clientes" },
      { name: "Endereços" },
      { name: "Contatos" },
      { name: "Financeiro" },
      { name: "Empresas" },
      { name: "Usuários" },
      { name: "Perfis" },
      { name: "Tabelas de frete" },
      { name: "Sistema" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Sistema"], summary: "Health check", security: [],
          responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } } },
        },
      },
      "/openapi.json": {
        get: { tags: ["Sistema"], summary: "Especificação OpenAPI", security: [], responses: { 200: { description: "OpenAPI 3.1" } } },
      },
      "/auth/token": {
        post: {
          tags: ["Auth"], summary: "Emite access_token + refresh_token", security: [],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["sistema_key", "api_key", "api_secret"], properties: { sistema_key: { type: "string" }, api_key: { type: "string" }, api_secret: { type: "string" } } } } } },
          responses: { 200: { description: "OK" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Auth"], summary: "Renova access_token via refresh_token", security: [],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["refresh_token"], properties: { refresh_token: { type: "string" } } } } } },
          responses: { 200: { description: "OK" }, 401: { $ref: "#/components/responses/Unauthorized" } },
        },
      },

      "/clientes": {
        get: {
          tags: ["Clientes"], summary: "Lista clientes",
          parameters: [
            { $ref: "#/components/parameters/Page" },
            { $ref: "#/components/parameters/PageSize" },
            { $ref: "#/components/parameters/Search" },
            { in: "query", name: "categoria", schema: { type: "string" } },
            { in: "query", name: "ativo", schema: { type: "boolean" } },
          ],
          security: [{ bearerAuth: ["clientes:read"] }],
          responses: { 200: { description: "OK" }, 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" }, 429: { $ref: "#/components/responses/RateLimited" } },
        },
        post: {
          tags: ["Clientes"], summary: "Cria cliente (idempotente por CNPJ + Idempotency-Key)",
          parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
          security: [{ bearerAuth: ["clientes:write"] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Cliente" } } } },
          responses: { 201: { description: "Criado" }, 200: { description: "Já existente para o CNPJ" }, 400: { $ref: "#/components/responses/ValidationError" }, 409: { description: "Conflito de idempotência" } },
        },
      },
      "/clientes/{id}": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: {
          tags: ["Clientes"], summary: "Detalhe do cliente",
          parameters: [{ in: "query", name: "include", schema: { type: "string", example: "enderecos,contatos" } }],
          security: [{ bearerAuth: ["clientes:read"] }],
          responses: { 200: { description: "OK" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
        patch: {
          tags: ["Clientes"], summary: "Atualiza cliente",
          security: [{ bearerAuth: ["clientes:write"] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Cliente" } } } },
          responses: { 200: { description: "OK" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
      },
      "/clientes/{id}/inativar": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        post: { tags: ["Clientes"], summary: "Inativa cliente", security: [{ bearerAuth: ["clientes:write"] }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { motivo: { type: "string" } } } } } }, responses: { 200: { description: "OK" } } },
      },
      "/clientes/{id}/reativar": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        post: { tags: ["Clientes"], summary: "Reativa cliente", security: [{ bearerAuth: ["clientes:write"] }], responses: { 200: { description: "OK" } } },
      },
      "/clientes/{id}/conta-corrente": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["Financeiro"], summary: "Saldo, limite e vencidos", security: [{ bearerAuth: ["financeiro:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/clientes/{id}/lancamentos": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: {
          tags: ["Financeiro"], summary: "Lançamentos da conta corrente",
          parameters: [
            { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/PageSize" },
            { in: "query", name: "tipo", schema: { type: "string", enum: ["debito", "credito"] } },
            { in: "query", name: "status", schema: { type: "string" } },
            { in: "query", name: "origem", schema: { type: "string" } },
            { in: "query", name: "de", schema: { type: "string", format: "date" } },
            { in: "query", name: "ate", schema: { type: "string", format: "date" } },
          ],
          security: [{ bearerAuth: ["clientes:read"] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/clientes/{id}/enderecos": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["Endereços"], summary: "Lista endereços", security: [{ bearerAuth: ["clientes:read"] }], responses: { 200: { description: "OK" } } },
        post: { tags: ["Endereços"], summary: "Cria endereço", security: [{ bearerAuth: ["enderecos:write"] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Endereco" } } } }, responses: { 201: { description: "Criado" } } },
      },
      "/clientes/{id}/enderecos/{enderecoId}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
          { in: "path", name: "enderecoId", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { tags: ["Endereços"], summary: "Detalhe", security: [{ bearerAuth: ["clientes:read"] }], responses: { 200: { description: "OK" } } },
        patch: { tags: ["Endereços"], summary: "Atualiza endereço", security: [{ bearerAuth: ["enderecos:write"] }], responses: { 200: { description: "OK" } } },
        delete: { tags: ["Endereços"], summary: "Inativa endereço (soft delete)", security: [{ bearerAuth: ["enderecos:write"] }], responses: { 200: { description: "OK" } } },
      },
      "/clientes/{id}/contatos": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["Contatos"], summary: "Lista contatos", security: [{ bearerAuth: ["clientes:read"] }], responses: { 200: { description: "OK" } } },
        post: { tags: ["Contatos"], summary: "Cria contato", security: [{ bearerAuth: ["contatos:write"] }], responses: { 201: { description: "Criado" } } },
      },
      "/clientes/{id}/contatos/{contatoId}": {
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } },
          { in: "path", name: "contatoId", required: true, schema: { type: "string", format: "uuid" } },
        ],
        get: { tags: ["Contatos"], summary: "Detalhe", security: [{ bearerAuth: ["clientes:read"] }], responses: { 200: { description: "OK" } } },
        patch: { tags: ["Contatos"], summary: "Atualiza contato", security: [{ bearerAuth: ["contatos:write"] }], responses: { 200: { description: "OK" } } },
        delete: { tags: ["Contatos"], summary: "Remove contato", security: [{ bearerAuth: ["contatos:write"] }], responses: { 200: { description: "OK" } } },
      },
      "/empresas": {
        get: { tags: ["Empresas"], summary: "Lista empresas", security: [{ bearerAuth: ["empresas:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/empresas/{id}": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["Empresas"], summary: "Detalhe da empresa", parameters: [{ in: "query", name: "include", schema: { type: "string", example: "filiais,modulos" } }], security: [{ bearerAuth: ["empresas:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/filiais": {
        get: { tags: ["Empresas"], summary: "Lista filiais", security: [{ bearerAuth: ["empresas:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/usuarios": {
        get: { tags: ["Usuários"], summary: "Lista usuários", security: [{ bearerAuth: ["usuarios:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/usuarios/{id}": {
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        get: { tags: ["Usuários"], summary: "Detalhe do usuário", parameters: [{ in: "query", name: "include", schema: { type: "string", example: "perfis,sistemas" } }], security: [{ bearerAuth: ["usuarios:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/perfis": {
        get: { tags: ["Perfis"], summary: "Lista perfis", parameters: [{ in: "query", name: "include", schema: { type: "string", example: "permissoes" } }], security: [{ bearerAuth: ["perfis:read"] }], responses: { 200: { description: "OK" } } },
      },
      "/tabelas-frete": {
        get: { tags: ["Tabelas de frete"], summary: "Lista tabelas de frete", security: [{ bearerAuth: ["tabela-frete:read"] }], responses: { 200: { description: "OK" } } },
      },
    },
    "x-pxapi": { scopes: SCOPES },
  };
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-request-id",
  };
}

export const Route = createFileRoute("/api/public/v1/openapi/json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(JSON.stringify(buildSpec(origin), null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            ...cors(),
          },
        });
      },
    },
  },
});
