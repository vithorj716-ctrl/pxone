// PX API — Envelope de resposta padronizado.
// Toda rota da PX API deve responder usando pxOk()/pxErr() para garantir
// o mesmo contrato em toda a plataforma.

export type PxApiOk<T> = {
  status: "ok";
  message: string;
  data: T;
  timestamp: string;
  requestId: string;
};

export type PxApiErr = {
  status: "error";
  message: string;
  data: null;
  timestamp: string;
  requestId: string;
  code: PxErrCode;
};

export type PxErrCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL";

const CODE_STATUS: Record<PxErrCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL: 500,
};

function newRequestId(): string {
  // crypto.randomUUID() existe no runtime do Worker e no browser
  try {
    return (globalThis.crypto as any)?.randomUUID?.() ?? fallback();
  } catch {
    return fallback();
  }
  function fallback() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") || newRequestId();
}

function jsonHeaders(requestId: string, extra?: HeadersInit): HeadersInit {
  return {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
    "cache-control": "no-store",
    ...(extra ?? {}),
  };
}

export function pxOk<T>(
  data: T,
  opts?: { message?: string; requestId?: string; status?: number; headers?: HeadersInit },
): Response {
  const requestId = opts?.requestId ?? newRequestId();
  const body: PxApiOk<T> = {
    status: "ok",
    message: opts?.message ?? "OK",
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
  return new Response(JSON.stringify(body), {
    status: opts?.status ?? 200,
    headers: jsonHeaders(requestId, opts?.headers),
  });
}

export function pxErr(
  code: PxErrCode,
  message: string,
  opts?: { requestId?: string; status?: number; headers?: HeadersInit; details?: unknown },
): Response {
  const requestId = opts?.requestId ?? newRequestId();
  const body: PxApiErr & { details?: unknown } = {
    status: "error",
    message,
    data: null,
    timestamp: new Date().toISOString(),
    requestId,
    code,
    ...(opts?.details !== undefined ? { details: opts.details } : {}),
  };
  return new Response(JSON.stringify(body), {
    status: opts?.status ?? CODE_STATUS[code],
    headers: jsonHeaders(requestId, opts?.headers),
  });
}

export function methodNotAllowed(allowed: string[], requestId?: string): Response {
  return pxErr("METHOD_NOT_ALLOWED", `Método não permitido. Use: ${allowed.join(", ")}`, {
    requestId,
    headers: { allow: allowed.join(", ") },
  });
}
