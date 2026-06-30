// PX Integration — configuração runtime de URLs/credenciais dos sistemas pares.
// Lê apenas em runtime de servidor (process.env). Modo standby quando não configurado.

export type PxSistema = "pxcrm" | "pxlog";

export type PxSistemaConfig = {
  sistema: PxSistema;
  baseUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  configured: boolean;
};

function readEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export function getSistemaConfig(sistema: PxSistema): PxSistemaConfig {
  const prefix = sistema === "pxcrm" ? "PX_CRM" : "PX_TMS";
  const baseUrl = readEnv(`${prefix}_BASE_URL`);
  const clientId = readEnv(`${prefix}_CLIENT_ID`);
  const clientSecret = readEnv(`${prefix}_CLIENT_SECRET`);
  return {
    sistema,
    baseUrl,
    clientId,
    clientSecret,
    configured: Boolean(baseUrl),
  };
}

export const PX_INTEGRATION_TIMEOUT_MS = 8000;
export const PX_INTEGRATION_RETRIES = 2;
export const PX_INTEGRATION_CACHE_TTL_MS = 60_000;
