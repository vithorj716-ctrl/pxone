// PX API — POST /api/public/v1/auth/token
// Troca api_key + secret por um JWT (15min) + refresh_token (30 dias).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPxApiSupabase } from "@/px-api/server-client";
import {
  signPxApiJwt,
  sha256Hex,
  constantTimeEqual,
  randomToken,
} from "@/px-api/jwt";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

const ACCESS_TTL_SEC = 15 * 60;          // 15 minutos
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 dias

const bodySchema = z.object({
  api_key: z.string().min(8),
  secret: z.string().min(8),
  // Subconjunto de escopos solicitados. Se ausente, herda todos do client.
  scopes: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/public/v1/auth/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch (e: any) {
          return pxErr("VALIDATION_ERROR", "Payload inválido.", {
            requestId,
            details: e?.errors ?? String(e?.message ?? e),
          });
        }

        const prefix = payload.api_key.slice(0, 12);
        const apiKeyHash = await sha256Hex(payload.api_key);
        const secretHash = await sha256Hex(payload.secret);

        const supabase = await getPxApiSupabase();
        const { data: client, error } = await (supabase as any)
          .from("px_api_clients")
          .select("id, sistema_key, nome, ativo, api_key_hash, secret_hash, escopos, rate_limit_rpm")
          .eq("api_key_prefix", prefix)
          .maybeSingle();

        if (error || !client || !client.ativo) {
          return pxErr("UNAUTHORIZED", "Credenciais inválidas.", { requestId });
        }
        if (
          !constantTimeEqual(client.api_key_hash, apiKeyHash) ||
          !constantTimeEqual(client.secret_hash, secretHash)
        ) {
          return pxErr("UNAUTHORIZED", "Credenciais inválidas.", { requestId });
        }

        // Escopos efetivos: interseção entre o solicitado e o autorizado.
        const allowed: string[] = client.escopos ?? [];
        const requested = payload.scopes && payload.scopes.length ? payload.scopes : allowed;
        const effective = requested.filter((s) => allowed.includes(s));
        if (requested.length && effective.length === 0) {
          return pxErr("FORBIDDEN", "Nenhum dos escopos solicitados está autorizado.", { requestId });
        }

        const now = Math.floor(Date.now() / 1000);
        const jti = randomToken(24);
        const refreshPlain = randomToken(32);
        const refreshHash = await sha256Hex(refreshPlain);
        const accessExp = now + ACCESS_TTL_SEC;
        const refreshExp = now + REFRESH_TTL_SEC;

        const access = await signPxApiJwt({
          sub: client.id,
          sk: client.sistema_key,
          scp: effective,
          jti,
          exp: accessExp,
        });

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-real-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          null;

        await (supabase as any).from("px_api_tokens").insert({
          api_client_id: client.id,
          jti,
          refresh_token_hash: refreshHash,
          escopos: effective,
          expires_at: new Date(accessExp * 1000).toISOString(),
          refresh_expires_at: new Date(refreshExp * 1000).toISOString(),
          ip,
          user_agent: request.headers.get("user-agent"),
        });

        return pxOk(
          {
            access_token: access,
            token_type: "Bearer",
            expires_in: ACCESS_TTL_SEC,
            refresh_token: refreshPlain,
            refresh_expires_in: REFRESH_TTL_SEC,
            scopes: effective,
            sistema_key: client.sistema_key,
          },
          { requestId, message: "Token emitido com sucesso." },
        );
      },
      GET: async ({ request }) => methodNotAllowed(["POST"], getRequestId(request)),
    },
  },
});
