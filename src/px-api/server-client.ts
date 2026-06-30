// PX API — Cliente Supabase para uso dentro das rotas /api/public/v1/*.
// Carrega supabaseAdmin dinamicamente (rotas são client-reachable, então
// não podemos importar @/integrations/supabase/client.server no topo).

import type { SupabaseClient } from "@supabase/supabase-js";

let adminPromise: Promise<SupabaseClient> | null = null;

export async function getPxApiSupabase(): Promise<SupabaseClient> {
  if (!adminPromise) {
    adminPromise = import("@/integrations/supabase/client.server").then(
      (m) => m.supabaseAdmin as unknown as SupabaseClient,
    );
  }
  return adminPromise;
}
