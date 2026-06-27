import type { LucideIcon } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, accent = "#22c55e", sub }: {
  icon: LucideIcon; label: string; value: string | number; accent?: string; sub?: string;
}) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="size-7 rounded-md flex items-center justify-center" style={{ background: accent + "20" }}>
          <Icon className="size-4" style={{ color: accent }} />
        </div>
      </div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
