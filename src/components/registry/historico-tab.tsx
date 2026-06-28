import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAudit } from "@/lib/px-audit.functions";
import { History, Loader2, Plus, Pencil, Power, RotateCcw, Copy, Trash2 } from "lucide-react";

const ACTION_META: Record<string, { label: string; icon: any; cls: string }> = {
  create: { label: "Criado", icon: Plus, cls: "text-emerald-300 bg-emerald-500/10" },
  update: { label: "Editado", icon: Pencil, cls: "text-sky-300 bg-sky-500/10" },
  inactivate: { label: "Inativado", icon: Power, cls: "text-amber-300 bg-amber-500/10" },
  reactivate: { label: "Reativado", icon: RotateCcw, cls: "text-emerald-300 bg-emerald-500/10" },
  duplicate: { label: "Duplicado", icon: Copy, cls: "text-violet-300 bg-violet-500/10" },
  delete: { label: "Removido", icon: Trash2, cls: "text-red-300 bg-red-500/10" },
};

export function HistoricoTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fn = useServerFn(listAudit);

  useEffect(() => {
    if (!entityId) return;
    let alive = true;
    setLoading(true);
    fn({ data: { entity_type: entityType, entity_id: entityId } })
      .then((r) => { if (alive) setRows(r as any[]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entityType, entityId, fn]);

  if (!entityId) {
    return <div className="text-sm text-muted-foreground p-6 text-center">O histórico fica disponível após o primeiro salvamento.</div>;
  }
  if (loading) return <div className="p-6 flex items-center justify-center text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>;
  if (!rows.length) return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      <History className="size-6 mx-auto mb-2 opacity-50" />
      Sem alterações registradas.
    </div>
  );

  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const meta = ACTION_META[r.action] ?? ACTION_META.update;
        const Icon = meta.icon;
        const diffEntries = r.diff ? Object.entries(r.diff as Record<string, { from: any; to: any }>) : [];
        return (
          <li key={r.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${meta.cls}`}>
                  <Icon className="size-3" /> {meta.label}
                </span>
                <span className="text-xs text-muted-foreground">{r.user_label ?? "—"}</span>
              </div>
              <time className="text-[11px] text-muted-foreground tabular-nums">
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </time>
            </div>
            {diffEntries.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {diffEntries.slice(0, 8).map(([k, v]) => (
                  <li key={k} className="font-mono">
                    <span className="text-muted-foreground">{k}:</span>{" "}
                    <span className="line-through text-red-300/70">{fmt(v.from)}</span>
                    {" → "}
                    <span className="text-emerald-300">{fmt(v.to)}</span>
                  </li>
                ))}
                {diffEntries.length > 8 && (
                  <li className="text-[10px] text-muted-foreground">+ {diffEntries.length - 8} alteração(ões)</li>
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function fmt(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
