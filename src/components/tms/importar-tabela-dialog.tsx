// Assistente de importação de tabelas comerciais: arquivo → mapeamento → validação → prévia → importar.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  montarImportacao, parseCSV, parseJSONTabela, parseXMLTabela, sugerirMapeamento,
  type ArquivoLido, type MapeamentoColuna, type ResultadoImport,
} from "@/pxlog/tabela-import";
import { BASES, MODOS, TIPOS_REGRA } from "@/pxlog/regra-engine";
import { importarTabelasFrete } from "@/lib/tms-tabelas.functions";

const campo = "h-9 w-full rounded-md bg-background ring-1 ring-border px-2 text-xs";

const DESTINOS = [
  { v: "ignorar", l: "Ignorar" },
  { v: "tabela", l: "Nome da tabela" },
  { v: "cliente", l: "Cliente (texto)" },
  { v: "origem", l: "Origem" },
  { v: "destino", l: "Destino" },
  { v: "rota", l: "Rota (texto)" },
  { v: "faixa_min", l: "Faixa inicial" },
  { v: "faixa_max", l: "Faixa final" },
  { v: "prazo", l: "Prazo (dias)" },
  { v: "regra", l: "Regra comercial" },
];

export function ImportarTabelaDialog({
  open, onOpenChange, onImportado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportado: () => void;
}) {
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [mapa, setMapa] = useState<MapeamentoColuna[]>([]);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [importando, setImportando] = useState(false);
  const fnImportar = useServerFn(importarTabelasFrete);

  async function lerArquivo(file: File) {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let lido: ArquivoLido;
      if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        const linhas = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
        const colunas = Object.keys(linhas[0] ?? {});
        lido = { colunas, linhas: linhas.map((l) => Object.fromEntries(colunas.map((c) => [c, String(l[c] ?? "").trim()]))) };
      } else {
        const texto = await file.text();
        lido = ext === "json" ? parseJSONTabela(texto) : ext === "xml" ? parseXMLTabela(texto) : parseCSV(texto);
      }
      if (!lido.colunas.length) throw new Error("Não foi possível identificar as colunas do arquivo.");
      const sugerido = sugerirMapeamento(lido.colunas);
      setArquivo(lido);
      setMapa(sugerido);
      setResultado(montarImportacao(lido, sugerido));
    } catch (e: any) {
      toast.error(e?.message ?? "Arquivo não reconhecido.");
    }
  }

  function atualizarMapa(i: number, patch: Partial<MapeamentoColuna>) {
    const novo = mapa.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    setMapa(novo);
    if (arquivo) setResultado(montarImportacao(arquivo, novo));
  }

  const erros = resultado?.problemas.filter((p) => p.nivel === "erro") ?? [];
  const vinculos = resultado?.problemas.filter((p) => p.nivel === "vinculo") ?? [];

  async function importar() {
    if (!resultado) return;
    setImportando(true);
    try {
      const r = await fnImportar({
        data: {
          tabelas: resultado.tabelas.map((t) => ({
            nome: t.nome,
            origem: t.origem,
            destino: t.destino,
            prazo_dias: t.prazo_dias,
            regras: t.regras,
          })),
          substituirRegras: true,
        },
      });
      toast.success(`${r.criadas} tabela(s) criada(s), ${r.atualizadas} atualizada(s), ${r.regras} regra(s).`);
      onOpenChange(false);
      setArquivo(null); setResultado(null);
      onImportado();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Importar tabela de preços</DialogTitle></DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Arquivo (XLSX, CSV, JSON ou XML)</Label>
            <Input type="file" accept=".xlsx,.xls,.csv,.json,.xml" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} />
          </div>

          {arquivo && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {arquivo.linhas.length} linha(s). Relacione cada coluna do arquivo com a estrutura da tabela comercial.
              </p>
              <div className="space-y-2">
                {mapa.map((m, i) => (
                  <div key={m.coluna} className="rounded-lg ring-1 ring-border p-2 grid gap-2 sm:grid-cols-[1fr_1fr_2fr] items-center">
                    <div className="text-xs font-medium break-words">{m.coluna}</div>
                    <select className={campo} value={m.destino} onChange={(e) => atualizarMapa(i, { destino: e.target.value as any })}>
                      {DESTINOS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                    </select>
                    {m.destino === "regra" && (
                      <div className="grid grid-cols-2 gap-1">
                        <Input className="h-9 text-xs" placeholder="Nome da regra" value={m.nome ?? ""} onChange={(e) => atualizarMapa(i, { nome: e.target.value })} />
                        <select className={campo} value={m.tipo ?? "taxa"} onChange={(e) => atualizarMapa(i, { tipo: e.target.value as any })}>
                          {TIPOS_REGRA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select className={campo} value={m.modo ?? "valor_fixo"} onChange={(e) => atualizarMapa(i, { modo: e.target.value as any })}>
                          {MODOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select className={campo} value={m.base_calculo ?? "nenhuma"} onChange={(e) => atualizarMapa(i, { base_calculo: e.target.value as any })}>
                          {BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado && (
            <div className="rounded-lg ring-1 ring-border p-3 text-xs space-y-1">
              <div className="font-medium">{resultado.totalRegras} regra(s) encontradas em {resultado.tabelas.length} tabela(s)</div>
              <div className="text-emerald-500">✓ {resultado.totalRegras - erros.length} prontas para importar</div>
              {!!vinculos.length && <div className="text-amber-500">⚠ {vinculos.length} precisam de vínculo</div>}
              {!!erros.length && <div className="text-rose-500">✕ {erros.length} com erro de valor</div>}
              {!!erros.length && (
                <div className="max-h-40 overflow-y-auto mt-2 space-y-1">
                  {erros.slice(0, 40).map((p, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground">
                      Linha {p.linha} · {p.coluna}: "{p.valor}" — {p.mensagem}
                    </div>
                  ))}
                </div>
              )}
              {!!resultado.tabelas.length && (
                <div className="mt-2 space-y-1">
                  {resultado.tabelas.slice(0, 8).map((t) => (
                    <div key={t.chave} className="text-[11px]">
                      <span className="font-medium">{t.nome}</span> — {t.regras.length} regra(s)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={!resultado || !!erros.length || importando}>
            {importando ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />} Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
