// PXSales — Captura rápida de lead em visita. Pensada para o celular:
// poucos campos, funciona sem internet e sincroniza sozinha quando a rede volta.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CloudOff, Loader2, MapPin, RefreshCw, Sparkles, Check } from "lucide-react";
import { PxSalesShell } from "@/components/pxsales/pxsales-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { capturarLeadRapido, type CapturaEntrada } from "@/lib/pxsales-captura.functions";

export const Route = createFileRoute("/_authenticated/sales/captura")({
  component: CapturaRapida,
  head: () => ({
    meta: [
      { title: "Captura rápida de lead | PXSales" },
      { name: "description", content: "Registre a visita comercial em segundos, mesmo sem internet, e sincronize depois." },
      { property: "og:title", content: "Captura rápida de lead | PXSales" },
      { property: "og:description", content: "Visita comercial registrada no celular, com sincronização automática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILA = "pxsales.captura.fila";

const lerFila = (): CapturaEntrada[] => {
  try {
    const raw = localStorage.getItem(FILA);
    return raw ? (JSON.parse(raw) as CapturaEntrada[]) : [];
  } catch {
    return [];
  }
};
const gravarFila = (itens: CapturaEntrada[]) => localStorage.setItem(FILA, JSON.stringify(itens));

const VAZIO = {
  empresa: "", cnpj: "", contato_nome: "", contato_telefone: "", contato_cargo: "",
  contato_email: "", cidade: "", uf: "", segmento: "", tipo_carga: "",
  potencial_mensal: "", temperatura: "morno", observacoes: "", proxima_acao: "", proxima_acao_em: "",
};

const TEMPERATURAS = [
  { v: "quente", l: "Quente" },
  { v: "morno", l: "Morno" },
  { v: "frio", l: "Frio" },
];

function CapturaRapida() {
  const enviar = useServerFn(capturarLeadRapido);
  const { empresa } = useEmpresaAtiva();

  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimos, setUltimos] = useState<{ empresa: string; situacao: string }[]>([]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    setPendentes(lerFila().length);
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void sincronizar(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (navigator.onLine) void sincronizar();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sincronizar() {
    const fila = lerFila();
    if (!fila.length || sincronizando) return;
    setSincronizando(true);
    const restantes: CapturaEntrada[] = [];
    let ok = 0;
    for (const item of fila) {
      try {
        await enviar({ data: item });
        ok++;
      } catch {
        restantes.push(item);
      }
    }
    gravarFila(restantes);
    setPendentes(restantes.length);
    setSincronizando(false);
    if (ok) toast.success(`${ok} visita(s) sincronizada(s).`);
  }

  function pegarLocal() {
    if (!navigator.geolocation) return toast.error("Este aparelho não informa a localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Local da visita anexado."); },
      () => toast.error("Não foi possível obter o local."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const valido = useMemo(() => !!f["empresa"]?.trim(), [f]);

  async function salvar() {
    if (!valido) return toast.error("Informe pelo menos o nome da empresa.");
    const entrada: CapturaEntrada = {
      captura_key: (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      empresa: f["empresa"]!.trim(),
      cnpj: f["cnpj"] || null,
      contato_nome: f["contato_nome"] || null,
      contato_cargo: f["contato_cargo"] || null,
      contato_telefone: f["contato_telefone"] || null,
      contato_email: f["contato_email"] || null,
      cidade: f["cidade"] || null,
      uf: f["uf"] || null,
      segmento: f["segmento"] || null,
      tipo_carga: f["tipo_carga"] || null,
      potencial_mensal: f["potencial_mensal"] || null,
      temperatura: f["temperatura"] || "morno",
      observacoes: f["observacoes"] || null,
      proxima_acao: f["proxima_acao"] || null,
      proxima_acao_em: f["proxima_acao_em"] || null,
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      capturado_em: new Date().toISOString(),
      empresa_id: empresa?.id ?? null,

    };

    setSalvando(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const r = await enviar({ data: entrada });
      setUltimos((u) => [{ empresa: r.empresa, situacao: r.situacao }, ...u].slice(0, 5));
      toast.success(
        r.situacao === "criado" ? "Lead criado." : r.situacao === "atualizado" ? "Visita somada a um lead já existente." : "Esta visita já havia sido enviada.",
      );
      setF({ ...VAZIO });
      setGeo(null);
    } catch (e: any) {
      console.error("captura", e?.message ?? e);

      const fila = [...lerFila(), entrada];
      gravarFila(fila);
      setPendentes(fila.length);
      setUltimos((u) => [{ empresa: entrada.empresa, situacao: "na fila" }, ...u].slice(0, 5));
      toast.message("Sem internet: a visita ficou guardada e será enviada sozinha.");
      setF({ ...VAZIO });
      setGeo(null);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <PxSalesShell title="Captura rápida" subtitle="Registre a visita em segundos, mesmo sem sinal">
      <div className="max-w-xl mx-auto space-y-4 pb-24">
        <div className="flex items-center justify-between rounded-xl ring-1 ring-border bg-surface/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5">
            {online ? <Sparkles className="size-3.5 text-emerald-500" /> : <CloudOff className="size-3.5 text-amber-500" />}
            {online ? "Conectado" : "Sem internet — as visitas ficam guardadas"}
          </span>
          <span className="flex items-center gap-2">
            {pendentes > 0 && <span className="text-amber-600">{pendentes} na fila</span>}
            <Button size="sm" variant="ghost" onClick={() => void sincronizar()} disabled={!pendentes || sincronizando}>
              {sincronizando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            </Button>
          </span>
        </div>

        <div className="rounded-xl ring-1 ring-border bg-surface/30 p-4 space-y-3">
          <div>
            <Label className="text-[11px]">Empresa visitada *</Label>
            <Input className="h-11 text-base" value={f["empresa"] ?? ""} onChange={(e) => set("empresa", e.target.value)} placeholder="Nome na fachada" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">CNPJ (opcional)</Label>
              <Input className="h-11" inputMode="numeric" value={f["cnpj"] ?? ""} onChange={(e) => set("cnpj", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Telefone</Label>
              <Input className="h-11" inputMode="tel" value={f["contato_telefone"] ?? ""} onChange={(e) => set("contato_telefone", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Contato</Label>
              <Input className="h-11" value={f["contato_nome"] ?? ""} onChange={(e) => set("contato_nome", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Cargo</Label>
              <Input className="h-11" value={f["contato_cargo"] ?? ""} onChange={(e) => set("contato_cargo", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Cidade</Label>
              <Input className="h-11" value={f["cidade"] ?? ""} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">UF</Label>
              <Input className="h-11" maxLength={2} value={f["uf"] ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label className="text-[11px]">Tipo de carga</Label>
              <Input className="h-11" value={f["tipo_carga"] ?? ""} onChange={(e) => set("tipo_carga", e.target.value)} />
            </div>
            <div>
              <Label className="text-[11px]">Potencial mensal (R$)</Label>
              <Input className="h-11" inputMode="decimal" value={f["potencial_mensal"] ?? ""} onChange={(e) => set("potencial_mensal", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Interesse</Label>
            <div className="flex gap-2 mt-1">
              {TEMPERATURAS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => set("temperatura", t.v)}
                  className={`flex-1 h-10 rounded-md text-xs ring-1 ${f["temperatura"] === t.v ? "ring-primary bg-primary/10" : "ring-border"}`}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[11px]">Anotações da visita</Label>
            <Textarea rows={3} value={f["observacoes"] ?? ""} onChange={(e) => set("observacoes", e.target.value)} placeholder="O que foi conversado, volumes, rotas, concorrente atual…" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Próxima ação</Label>
              <Input className="h-11" value={f["proxima_acao"] ?? ""} onChange={(e) => set("proxima_acao", e.target.value)} placeholder="Enviar cotação" />
            </div>
            <div>
              <Label className="text-[11px]">Quando</Label>
              <Input className="h-11" type="date" value={f["proxima_acao_em"] ?? ""} onChange={(e) => set("proxima_acao_em", e.target.value)} />
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={pegarLocal} className="w-full">
            <MapPin className="size-4 mr-1" /> {geo ? "Local anexado" : "Anexar local da visita"}
          </Button>
        </div>

        {ultimos.length > 0 && (
          <div className="rounded-xl ring-1 ring-border divide-y divide-border text-xs">
            {ultimos.map((u, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-1.5"><Check className="size-3.5 text-emerald-500" />{u.empresa}</span>
                <span className="text-muted-foreground">{u.situacao}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 sm:static sm:px-0 sm:mt-4">
        <div className="max-w-xl mx-auto">
          <Button className="w-full h-12 text-base" onClick={salvar} disabled={salvando || !valido}>
            {salvando && <Loader2 className="size-4 mr-1 animate-spin" />} Salvar visita
          </Button>
        </div>
      </div>
    </PxSalesShell>
  );
}
