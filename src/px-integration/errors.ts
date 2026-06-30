// Erro estruturado para falhas de integração entre sistemas PX.

export type PxIntegrationErrorCode =
  | "STANDBY"          // sistema ainda não configurado (sem URL)
  | "TIMEOUT"
  | "NETWORK"
  | "UNAUTHORIZED"
  | "UPSTREAM_4XX"
  | "UPSTREAM_5XX"
  | "CIRCUIT_OPEN"
  | "PARSE";

export class PxIntegrationError extends Error {
  code: PxIntegrationErrorCode;
  sistema: string;
  status?: number;
  upstreamBody?: unknown;

  constructor(args: {
    code: PxIntegrationErrorCode;
    sistema: string;
    message: string;
    status?: number;
    upstreamBody?: unknown;
  }) {
    super(args.message);
    this.name = "PxIntegrationError";
    this.code = args.code;
    this.sistema = args.sistema;
    this.status = args.status;
    this.upstreamBody = args.upstreamBody;
  }

  toEnvelope() {
    return {
      code: this.code,
      sistema: this.sistema,
      message: this.message,
      status: this.status,
    };
  }
}
