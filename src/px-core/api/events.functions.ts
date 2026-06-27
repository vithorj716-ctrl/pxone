// PX API Layer — emissão e leitura de eventos do barramento.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tipo: string; origem?: string; payload?: Record<string, unknown> }) => {
    if (!i?.tipo || typeof i.tipo !== "string") throw new Error("tipo é obrigatório");
    return { tipo: i.tipo, origem: i.origem ?? null, payload: i.payload ?? {} };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("px_events").insert({
      tipo: data.tipo,
      origem: data.origem,
      payload: data.payload as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("px_events")
      .select("id, tipo, origem, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { eventos: data ?? [] };
  });
