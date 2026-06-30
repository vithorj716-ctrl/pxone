// PX API — POST /api/public/v1/auth/refresh
// Troca um refresh_token válido por um novo access_token (e roda o refresh).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPxApiSupabase } from "@/px-api/server-client";
import { signPxApiJwt, sha256Hex, randomToken } from "@/px-api/jwt";
import { pxOk, pxErr, getRequestId, methodNotAllowed } from "@/px-api/envelope";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

const bodySchema = z.object({
  refresh_token: z.string().min(16),
});

export const Route = createFileRoute("/api/public/v1/auth/refresh")({
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

        const hash = await sha256Hex(payload.refresh_token);
        const supabase = await getPxApiSupabase();

        const { data: token } = await (supabase as any)
          .from("px_api_tokens")
          .select("id, api_client_id, escopos, revogado, refresh_expires_at")
          .eq("refresh_token_hash", hash)
          .maybeSingle();

        if (!token || token.revogado) {
          return pxErr("UNAUTHORIZED", "Refresh token inválido.", { requestId });
        }
        if (token.refresh_expires_at && new Date(token.refresh_expires_at).getTime() < Date.now()) {
          return pxErr("UNAUTHORIZED", "Refresh token expirado.", { requestId });
        }

        const { data: client } = await (supabase as any)
          .from("px_api_clients")
          .select("id, sistema_key, ativo")
          .eq("id", token.api_client_id)
          .maybeSingle();
        if (!client || !client.ativo) {
          return pxErr("UNAUTHORIZED", "Sistema inativo.", { requestId });
        }

        // Rotaciona: revoga o antigo, cria um novo.
        await (supabase as any).from("px_api_tokens").update({ revogado: true, revogado_em: new Date().toISOString() }).eq("id", token.id);

        const now = Math.floor(Date.now() / 1000);
        const jti = randomToken(24);
        const newRefresh = randomToken(32);
        const newRefreshHash = await sha256Hex(newRefresh);
        const accessExp = now + ACCESS_TTL_SEC;
        const refreshExp = now + REFRESH_TTL_SEC;

        const access = await signPxApiJwt({
          sub: client.id,
          sk: client.sistema_key,
          scp: token.escopos ?? [],
          jti,
          exp: accessExp,
        });

        await (supabase as any).from("px_api_tokens").insert({
          api_client_id: client.id,
          jti,
          refresh_token_hash: newRefreshHash,
          escopos: token.escopos ?? [],
          expires_at: new Date(accessExp * 1000).toISOString(),
          refresh_expires_at: new Date(refreshExp * 1000).toISOString(),
        });

        return pxOk(
          {
            access_token: access,
            token_type: "Bearer",
            expires_in: ACCESS_TTL_SEC,
            refresh_token: newRefresh,
            refresh_expires_in: REFRESH_TTL_SEC,
            scopes: token.escopos ?? [],
            sistema_key: client.sistema_key,
          },
          { requestId, message: "Token renovado." },
        );
      },
      GET: async ({ request }) => methodNotAllowed(["POST"], getRequestId(request)),
    },
  },
});
