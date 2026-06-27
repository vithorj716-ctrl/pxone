import { Phone, MapPin, Clock, Package, Star } from "lucide-react";
import { QrSvg } from "@/components/tms/qr-label";
import { LM_STATUS_ENTREGA, LM_PRIORIDADE, type LmStatusEntrega } from "@/lib/tms-lm";

export type EntregaCardData = {
  id: string;
  destinatario: string;
  cliente?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  qtd_volumes: number;
  peso: number;
  cubagem: number;
  valor_mercadoria: number;
  prioridade: keyof typeof LM_PRIORIDADE;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  observacoes?: string | null;
  status: LmStatusEntrega;
  tempo_estimado_min?: number | null;
  distancia_km?: number | null;
  codigo_qr?: string | null;
};

export function EntregaCard({ e }: { e: EntregaCardData }) {
  const s = LM_STATUS_ENTREGA[e.status] ?? LM_STATUS_ENTREGA.aguardando_separacao;
  const p = LM_PRIORIDADE[e.prioridade] ?? LM_PRIORIDADE.media;
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface p-4 flex gap-3" style={{ borderLeft: `4px solid ${s.color}` }}>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold truncate">{e.destinatario}</div>
            {e.cliente && <div className="text-xs text-muted-foreground truncate">{e.cliente}</div>}
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold" style={{ background: s.color, color: "#000" }}>{s.label}</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {e.endereco && <div className="flex items-start gap-1.5"><MapPin className="size-3.5 mt-0.5 shrink-0" /><span className="truncate">{e.endereco} — {e.cidade}</span></div>}
          {e.telefone && <div className="flex items-center gap-1.5"><Phone className="size-3.5" /> {e.telefone}</div>}
          {(e.janela_inicio || e.janela_fim) && (
            <div className="flex items-center gap-1.5"><Clock className="size-3.5" />
              {e.janela_inicio ? new Date(e.janela_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
              {" – "}
              {e.janela_fim ? new Date(e.janela_fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1"><Package className="size-3" />{e.qtd_volumes} vols · {e.peso}kg</span>
          <span className="inline-flex items-center gap-1" style={{ color: p.color }}><Star className="size-3" />{p.label}</span>
          {e.tempo_estimado_min != null && <span className="text-muted-foreground">{e.tempo_estimado_min}min</span>}
          {e.distancia_km != null && <span className="text-muted-foreground">{e.distancia_km}km</span>}
        </div>
        {e.observacoes && <div className="text-[11px] text-muted-foreground italic">{e.observacoes}</div>}
      </div>
      {e.codigo_qr && (
        <div className="shrink-0 bg-white p-1 rounded">
          <QrSvg value={e.codigo_qr} size={72} />
        </div>
      )}
    </div>
  );
}
