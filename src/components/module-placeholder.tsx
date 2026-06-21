import { AppShell } from "@/components/app-shell";
import { Construction } from "lucide-react";

export function ModulePlaceholder({
  title,
  subtitle,
  description,
  bullets,
}: {
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
}) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className="bg-surface ring-1 ring-border rounded-xl p-10">
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-md bg-brand/10 grid place-items-center text-brand shrink-0">
            <Construction className="size-5" />
          </div>
          <div className="space-y-3 flex-1">
            <h2 className="text-xl font-medium tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          {bullets.map((b) => (
            <div key={b} className="p-4 bg-background ring-1 ring-border rounded-md flex items-start gap-3">
              <div className="size-1.5 bg-brand rounded-full mt-1.5 shrink-0" />
              <p className="text-sm text-foreground/90">{b}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-brand/5 ring-1 ring-brand/20 rounded-md">
          <p className="text-xs text-brand font-medium uppercase tracking-widest mb-2">Próxima fase</p>
          <p className="text-sm text-foreground/90">
            Este módulo está estruturado e pronto para ser alimentado com dados reais. Solicite
            implementação completa quando quiser conectá-lo ao banco do Grupo PX.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
