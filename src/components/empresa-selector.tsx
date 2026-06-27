import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check, Layers } from "lucide-react";
import { useEmpresaAtiva } from "@/px-core/empresa-context";

export function EmpresaSelector() {
  const { empresa, isGrupo, empresas, setEmpresa } = useEmpresaAtiva();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const label = isGrupo
    ? "Visão do Grupo"
    : empresa?.nome_fantasia || empresa?.nome || "Selecionar empresa";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md ring-1 ring-border bg-surface/60 text-xs hover:bg-surface text-foreground transition-colors max-w-[160px] sm:max-w-none"
        title="Trocar empresa"
      >
        {isGrupo ? (
          <Layers className="size-3.5 text-brand shrink-0" />
        ) : empresa?.logo_url ? (
          <img src={empresa.logo_url} alt="" className="size-4 rounded object-cover shrink-0" />
        ) : (
          <Building2 className="size-3.5 text-brand shrink-0" />
        )}
        <span className="truncate font-medium">{label}</span>
        <ChevronDown className="size-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 bg-surface ring-1 ring-border rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="p-1 max-h-80 overflow-y-auto thin-scroll">
            <button
              onClick={() => { setEmpresa(null); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-surface-2 transition-colors ${isGrupo ? "bg-surface-2" : ""}`}
            >
              <Layers className="size-4 text-brand" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Visão do Grupo</div>
                <div className="text-[10px] text-muted-foreground">Dados consolidados</div>
              </div>
              {isGrupo && <Check className="size-3.5 text-brand" />}
            </button>

            <div className="my-1 h-px bg-border/60" />

            {empresas.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhuma empresa cadastrada
              </div>
            )}

            {empresas.map((e) => {
              const active = empresa?.id === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => { setEmpresa(e.id); setOpen(false); }}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-surface-2 transition-colors ${active ? "bg-surface-2" : ""}`}
                >
                  {e.logo_url ? (
                    <img src={e.logo_url} alt="" className="size-5 rounded object-cover shrink-0" />
                  ) : (
                    <div
                      className="size-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: e.cor_primaria || "var(--gradient-brand)" }}
                    >
                      {(e.codigo || e.nome).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.nome_fantasia || e.nome}</div>
                    {e.segmento && (
                      <div className="text-[10px] text-muted-foreground truncate">{e.segmento}</div>
                    )}
                  </div>
                  {active && <Check className="size-3.5 text-brand shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
