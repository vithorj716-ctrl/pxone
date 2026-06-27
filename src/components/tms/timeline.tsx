import { Check, Circle, AlertTriangle } from "lucide-react";
import { STATUS_VOL_LABEL } from "@/lib/tms";

export type EventoTimeline = {
  id: string;
  tipo: string;
  created_at: string;
  origem_evento?: string | null;
  payload?: any;
};

export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return <div className="text-xs text-muted-foreground py-4 text-center">Sem eventos.</div>;
  }
  return (
    <ol className="relative border-l border-border ml-3 space-y-3">
      {eventos.map((e) => {
        const meta = STATUS_VOL_LABEL[e.tipo];
        const isOcorr = e.tipo === "ocorrencia" || e.tipo === "devolucao";
        const isFinal = e.tipo === "entregue";
        return (
          <li key={e.id} className="pl-4 relative">
            <span className={`absolute -left-2 top-1 size-4 rounded-full flex items-center justify-center ring-2 ring-background ${
              isOcorr ? "bg-rose-500/30 text-rose-300"
                : isFinal ? "bg-emerald-500/30 text-emerald-300"
                : "bg-brand/30 text-brand"
            }`}>
              {isOcorr ? <AlertTriangle className="size-2.5" />
                : isFinal ? <Check className="size-2.5" />
                : <Circle className="size-2 fill-current" />}
            </span>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{meta?.label || e.tipo}</span>
              <time className="text-[10px] text-muted-foreground tabular-nums">
                {new Date(e.created_at).toLocaleString("pt-BR", { hour12: false })}
              </time>
            </div>
            {e.origem_evento && (
              <div className="text-[10px] text-muted-foreground">{e.origem_evento}</div>
            )}
            {e.payload?.observacao && (
              <div className="text-[10px] text-muted-foreground italic">{e.payload.observacao}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
