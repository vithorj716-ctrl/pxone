import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditAction = "create" | "update" | "inactivate" | "reactivate" | "duplicate" | "delete";

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { entity_type: string; entity_id: string; action: AuditAction; diff?: Record<string, unknown> | null }) => {
    if (!d?.entity_type) throw new Error("entity_type obrigatório");
    if (!d?.entity_id) throw new Error("entity_id obrigatório");
    if (!d?.action) throw new Error("action obrigatória");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const label = (claims as any)?.email ?? (claims as any)?.user_metadata?.full_name ?? null;
    const { error } = await (supabase as any).from("px_audit_log").insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.action,
      diff: data.diff ?? null,
      user_id: userId,
      user_label: label,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { entity_type: string; entity_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("px_audit_log")
      .select("*")
      .eq("entity_type", data.entity_type)
      .eq("entity_id", data.entity_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export function computeDiff(before: Record<string, any> | null, after: Record<string, any>): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === "updated_at" || k === "created_at" || k === "updated_by" || k === "created_by") continue;
    const a = before?.[k];
    const b = after[k];
    const eq = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!eq) diff[k] = { from: a ?? null, to: b ?? null };
  }
  return diff;
}
