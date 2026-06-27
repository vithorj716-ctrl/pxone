import { Link } from "@tanstack/react-router";
import { Truck, MapPin, Camera, AlertTriangle, CheckCircle2, User, Package } from "lucide-react";
import { LM_STATUS_ROTA, type LmStatusRota, progressoRota, isAtrasada } from "@/lib/tms-lm";

export type RotaCardData = {
  id: string;
  numero: number;
  motorista?: string | null;
  veiculo?: string | null;
  cidade?: string | null;
  qtdEntregas: number;
  qtdVolumes: number;
  peso: number;
  cubagem: number;
  horaSaida?: string | null;
  horaPrevista?: string | null;
  status: LmStatusRota;
  valorRota: number;
  entregas: { status: string }[];
};

export function RotaCard({ r, onFinalizar }: { r: RotaCardData; onFinalizar?: (id: string) => void }) {
  const meta = LM_STATUS_ROTA[r.status] ?? LM_STATUS_ROTA.planejada;
  const pct = progressoRota(r.entregas);
  const atrasada = isAtrasada(r.horaPrevista) && r.status !== "finalizada";

  return (
    <div
      className="rounded-xl ring-1 ring-border p-4 flex flex-col gap-3 transition hover:ring-2"
      style={{ background: meta.bg, borderColor: meta.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Rota</div>
          <div className="text-2xl font-bold leading-none">#{r.numero}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold"
            style={{ background: meta.color, color: "#000" }}
          >
            {meta.label}
          </span>
          {atrasada && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-600 text-white inline-flex items-center gap-1">
              <AlertTriangle className="size-3" /> Atrasada
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground"><User className="size-3.5" />{r.motorista ?? "—"}</div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><Truck className="size-3.5" />{r.veiculo ?? "—"}</div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" />{r.cidade ?? "—"}</div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><Package className="size-3.5" />{r.qtdEntregas} entregas · {r.qtdVolumes} vols</div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">{pct}% concluído</span>
          <span className="font-mono">{r.peso.toFixed(0)}kg · {r.cubagem.toFixed(2)}m³</span>
        </div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Valor</span>
        <span className="font-bold text-base">R$ {r.valorRota.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <div className="grid grid-cols-5 gap-1 pt-2 border-t border-white/10">
        <Link to="/tms/lm/rotas/$numero" params={{ numero: String(r.numero) }} className="text-[10px] uppercase tracking-wider py-1.5 rounded hover:bg-white/10 text-center font-semibold">Abrir</Link>
        <button className="text-[10px] uppercase tracking-wider py-1.5 rounded hover:bg-white/10 inline-flex items-center justify-center gap-1"><MapPin className="size-3" />Mapa</button>
        <Link to="/tms/lm/comprovantes" search={{ rota: r.numero } as never} className="text-[10px] uppercase tracking-wider py-1.5 rounded hover:bg-white/10 inline-flex items-center justify-center gap-1"><Camera className="size-3" />POD</Link>
        <Link to="/tms/lm/ocorrencias" className="text-[10px] uppercase tracking-wider py-1.5 rounded hover:bg-white/10 inline-flex items-center justify-center gap-1"><AlertTriangle className="size-3" />Ocor.</Link>
        <button onClick={() => onFinalizar?.(r.id)} className="text-[10px] uppercase tracking-wider py-1.5 rounded hover:bg-white/10 inline-flex items-center justify-center gap-1"><CheckCircle2 className="size-3" />Fim</button>
      </div>
    </div>
  );
}
