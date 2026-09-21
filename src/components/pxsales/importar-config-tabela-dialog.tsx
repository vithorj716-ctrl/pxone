// PXSales — importar/exportar as configurações da versão da tabela comercial.
// Aceita JSON exportado da própria tela e planilhas de faixas de peso (XLSX/CSV).
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPONENTES_CATALOGO, ORDEM_PADRAO, type Componente, type Faixa } from "@/pxsales/tabela-engine";

type Previa = { componentes: Componente[]; resumo: string[]; origem: string };

const num = (v: any) => {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

const achar = (linha: Record<string, any>, chaves: string[]) => {
  const entradas = Object.entries(linha);
  for (const c of chaves) {
    const hit = entradas.find(([k]) =>
      k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(c),
    );
    if (hit && String(hit[1] ?? "").trim() !== "") return hit[1];
  }
  return "";
};

function faixasDeLinhas(linhas: Record<string, any>[]): Faixa[] {
  return linhas
    .map((l) => ({
      peso_min: num(achar(l, ["peso_min", "de (kg)", "de", "inicial", "min"])),
      peso_max: num(achar(l, ["peso_max", "ate (kg)", "ate", "final", "max"])),
      tipo_valor: (() => {
        const t = String(achar(l, ["tipo"]) ?? "").toLowerCase();
        if (t.includes("kg")) return "por_kg" as const;
        if (t.includes("%") || t.includes("percent")) return "percentual" as const;
        return "fixo" as const;
      })(),
      valor: num(achar(l, ["valor", "preco", "tarifa"])),
      valor_minimo: num(achar(l, ["minimo", "frete minimo"])),
    }))
    .filter((f) => f.peso_max > 0 || f.valor > 0);
}

export function ImportarConfigTabelaDialog({
  open,
  onOpenChange,
  componentesAtuais,
  nomeTabela,
  bloqueado,
  onAplicar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  componentesAtuais: Componente[];
  nomeTabela: string;
  bloqueado: boolean;
  onAplicar: (comps: Componente[]) => void;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [lendo, setLendo] = useState(false);

  function exportar() {
    const blob = new Blob([JSON.stringify({ tabela: nomeTabela, componentes: componentesAtuais }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tabela-${nomeTabela.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function lerArquivo(file: File) {
    setLendo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        const dados = JSON.parse(await file.text());
        const comps: Componente[] = Array.isArray(dados) ? dados : (dados.componentes ?? []);
        if (!comps.length) throw new Error("Nenhum componente encontrado no arquivo.");
        setPrevia({
          origem: file.name,
          componentes: comps.map((c, i) => ({
            ...c,
            id: undefined,
            ativo: c.ativo !== false,
            ordem: ORDEM_PADRAO.indexOf(c.codigo) >= 0 ? ORDEM_PADRAO.indexOf(c.codigo) : 50 + i,
            config: c.config ?? {},
            faixas: (c.faixas ?? []).map((f) => ({ ...f, id: undefined })),
          })),
          resumo: comps.map((c) => `${c.nome}${c.faixas?.length ? ` · ${c.faixas.length} faixa(s)` : ""}`),
        });
      } else {
        let linhas: Record<string, any>[] = [];
        if (ext === "xlsx" || ext === "xls") {
          const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]!]!;
          linhas = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
        } else {
          const texto = await file.text();
          const [cab, ...resto] = texto.split(/\r?\n/).filter((l) => l.trim());
          const sep = (cab ?? "").includes(";") ? ";" : ",";
          const cols = (cab ?? "").split(sep).map((c) => c.trim());
          linhas = resto.map((l) => Object.fromEntries(l.split(sep).map((v, i) => [cols[i] ?? `col${i}`, v.trim()])));
        }
        const faixas = faixasDeLinhas(linhas);
        if (!faixas.length) throw new Error("Não encontramos faixas de peso válidas na planilha.");
        const base = componentesAtuais.filter((c) => c.codigo !== "faixa_peso");
        const catalogo = COMPONENTES_CATALOGO.find((c) => c.codigo === "faixa_peso")!;
        setPrevia({
          origem: file.name,
          componentes: [
            ...base,
            {
              codigo: catalogo.codigo,
              tipo: catalogo.tipo,
              nome: catalogo.nome,
              ativo: true,
              ordem: ORDEM_PADRAO.indexOf("faixa_peso"),
              config: {},
              faixas,
            },
          ],
          resumo: faixas
            .slice(0, 12)
            .map((f) => `${f.peso_min} a ${f.peso_max} kg · ${f.tipo_valor} ${f.valor}`),
        });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Arquivo não reconhecido.");
      setPrevia(null);
    } finally {
      setLendo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar configurações da tabela</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-2 rounded-lg ring-1 ring-border p-3">
            <div className="text-xs text-muted-foreground">
              Baixe a configuração atual para usar como modelo ou enviar para outra tabela.
            </div>
            <Button size="sm" variant="secondary" onClick={exportar}>
              <Download className="size-4 mr-1" /> Exportar
            </Button>
          </div>

          <div>
            <Label>Arquivo (JSON de tabela ou planilha XLSX/CSV de faixas de peso)</Label>
            <Input
              type="file"
              accept=".json,.xlsx,.xls,.csv"
              disabled={bloqueado || lendo}
              onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Planilha: colunas De (kg), Até (kg), Tipo, Valor e Mínimo.
            </p>
          </div>

          {bloqueado && (
            <p className="text-[11px] text-amber-600">
              Esta versão está publicada. Crie uma nova versão para importar configurações.
            </p>
          )}

          {previa && (
            <div className="rounded-lg ring-1 ring-border p-3 text-xs space-y-1">
              <div className="font-medium">
                {previa.componentes.length} componente(s) prontos a partir de {previa.origem}
              </div>
              {previa.resumo.map((r, i) => (
                <div key={i} className="text-[11px] text-muted-foreground">
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={!previa || bloqueado || lendo}
            onClick={() => {
              if (!previa) return;
              onAplicar(previa.componentes);
              setPrevia(null);
              onOpenChange(false);
              toast.success("Configurações carregadas. Confira e clique em Salvar.");
            }}
          >
            {lendo ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />} Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
