// Indicador financeiro / status do cliente (semáforo).
// Verde = normal | Amarelo = próximo do limite | Vermelho = excedido | Cinza = inativo.
// Por enquanto, sem Conta Corrente (Fase 2), considera apenas ativo + limite cadastrado.
export type ClienteStatus = "normal" | "alerta" | "excedido" | "inativo";

export function getClienteStatus(c: any): ClienteStatus {
  if (!c) return "normal";
  if (c.ativo === false) return "inativo";
  const limite = Number(c.limite_credito ?? 0);
  const utilizado = Number(c.saldo_utilizado ?? 0);
  if (limite > 0 && utilizado > limite) return "excedido";
  if (limite > 0 && utilizado >= limite * 0.8) return "alerta";
  return "normal";
}

const META: Record<ClienteStatus, { label: string; cls: string; dot: string }> = {
  normal: { label: "Normal", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  alerta: { label: "Próximo do limite", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  excedido: { label: "Limite excedido", cls: "text-red-300 bg-red-500/10 border-red-500/30", dot: "bg-red-400" },
  inativo: { label: "Inativo", cls: "text-muted-foreground bg-muted/40 border-border", dot: "bg-muted-foreground" },
};

export function ClienteStatusDot({ cliente, withLabel = false }: { cliente: any; withLabel?: boolean }) {
  const s = getClienteStatus(cliente);
  const m = META[s];
  const title = `${m.label}${cliente?.limite_credito ? ` — Limite R$ ${Number(cliente.limite_credito).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`;
  if (withLabel) {
    return (
      <span title={title} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border ${m.cls}`}>
        <span className={`size-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </span>
    );
  }
  return <span title={title} className={`inline-block size-2 rounded-full ${m.dot}`} aria-label={m.label} />;
}
