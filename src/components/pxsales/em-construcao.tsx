import type { ReactNode } from "react";

export function EmConstrucao({
  titulo,
  descricao,
  etapa,
  itens,
  children,
}: {
  titulo: string;
  descricao: string;
  etapa: string;
  itens?: string[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-surface/30 p-5 sm:p-7">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{etapa}</div>
      <h2 className="text-base sm:text-lg font-semibold mt-1">{titulo}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{descricao}</p>
      {itens?.length ? (
        <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 max-w-2xl">
          {itens.map((i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
              <span className="mt-1.5 size-1 rounded-full bg-muted-foreground/60 shrink-0" />
              {i}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}
