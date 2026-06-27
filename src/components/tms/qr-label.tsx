import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { PXLOG_LOGO_URL } from "@/components/pxlog-logo";

export function QrSvg({ value, size = 96 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 0, width: size, errorCorrectionLevel: "H" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value, size]);
  return <div className="inline-block" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Barcode({ value, height = 56 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height,
        width: 1.6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      /* noop */
    }
  }, [value, height]);
  return <svg ref={ref} style={{ width: "100%", height }} />;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  solicitado: { label: "SOLICITADO", bg: "#475569", fg: "#ffffff" },
  coleta_programada: { label: "COLETA PROGRAMADA", bg: "#d97706", fg: "#ffffff" },
  coletado: { label: "COLETADO", bg: "#d97706", fg: "#ffffff" },
  recebido_hub_origem: { label: "NO HUB", bg: "#0284c7", fg: "#ffffff" },
  conferido: { label: "CONFERIDO", bg: "#0284c7", fg: "#ffffff" },
  etiquetado: { label: "ETIQUETADO", bg: "#0284c7", fg: "#ffffff" },
  embarcado: { label: "EMBARCADO", bg: "#4f46e5", fg: "#ffffff" },
  em_transferencia: { label: "TRANSFERÊNCIA", bg: "#4f46e5", fg: "#ffffff" },
  recebido_hub_destino: { label: "HUB DESTINO", bg: "#7c3aed", fg: "#ffffff" },
  separado: { label: "SEPARADO", bg: "#7c3aed", fg: "#ffffff" },
  em_rota: { label: "EM ROTA", bg: "#0891b2", fg: "#ffffff" },
  saiu_entrega: { label: "EM ROTA", bg: "#0891b2", fg: "#ffffff" },
  entregue: { label: "ENTREGUE", bg: "#059669", fg: "#ffffff" },
};

const FLAG_STYLES: Record<string, { label: string; bg: string }> = {
  fragil: { label: "FRÁGIL", bg: "#dc2626" },
  empilhar: { label: "EMPILHAR", bg: "#0284c7" },
  nao_empilhar: { label: "NÃO EMPILHAR", bg: "#dc2626" },
  urgente: { label: "URGENTE", bg: "#dc2626" },
  medicamento: { label: "MEDICAMENTO", bg: "#059669" },
  controlado: { label: "CONTROLADO", bg: "#7c3aed" },
  refrigerado: { label: "REFRIGERADO", bg: "#0891b2" },
  inflamavel: { label: "INFLAMÁVEL", bg: "#ea580c" },
};

export type QrLabelProps = {
  codigo: string;
  numeroMinuta: number | string;
  numeroVol: number;
  totalVol: number;
  status?: string;
  flags?: string[];

  cliente?: string | null;
  remetente?: string | null;
  destinatario?: string | null;
  telefone?: string | null;

  // endereço
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidadeDestino?: string | null;
  cep?: string | null;
  origem?: string | null;
  destino?: string | null;

  // carga
  pesoReal?: number | null;
  pesoCubado?: number | null;
  pesoTaxado?: number | null;
  cubagem?: number | null;
  tipoMercadoria?: string | null;

  // rota
  hubOrigem?: string | null;
  hubDestino?: string | null;
  prazoDias?: number | null;

  data?: string;
  trackingUrl?: string;
};

/** Etiqueta logística profissional 100x150mm (vertical) — pronta para impressão térmica. */
export function QrLabel(props: QrLabelProps) {
  const {
    codigo,
    numeroMinuta,
    numeroVol,
    totalVol,
    status = "solicitado",
    flags = [],
    cliente,
    remetente,
    destinatario,
    telefone,
    rua,
    numero,
    bairro,
    cidadeDestino,
    cep,
    origem,
    destino,
    pesoReal,
    pesoCubado,
    pesoTaxado,
    cubagem,
    tipoMercadoria,
    hubOrigem,
    hubDestino,
    prazoDias,
    data,
    trackingUrl,
  } = props;

  const st = STATUS_STYLES[status] ?? STATUS_STYLES.solicitado;
  const minutaFmt = String(numeroMinuta).padStart(8, "0");
  const qrPayload = trackingUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/tms/tracking?c=${codigo}`;
  const enderecoLinha1 = [rua, numero && `nº ${numero}`].filter(Boolean).join(", ");
  const enderecoLinha2 = [bairro, cidadeDestino && `${cidadeDestino}${destino ? `/${destino}` : ""}`, cep && `CEP ${cep}`].filter(Boolean).join(" · ");

  return (
    <div
      className="tms-label bg-white text-black flex flex-col font-sans"
      style={{
        width: "100mm",
        height: "150mm",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        pageBreakAfter: "always",
        boxSizing: "border-box",
        padding: "2.5mm",
        gap: "1.5mm",
        border: "0.4mm solid #000",
      }}
    >
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between" style={{ borderBottom: "0.3mm solid #000", paddingBottom: "1.5mm" }}>
        <img src={PXLOG_LOGO_URL} alt="PXLog" style={{ height: "8mm", width: "auto" }} />
        <div className="text-right">
          <div style={{ fontSize: "7pt", letterSpacing: "0.05em", lineHeight: 1 }}>TRANSFER HUB</div>
          <div style={{ fontSize: "8pt", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.2 }}>MINUTA</div>
          <div style={{ fontSize: "14pt", fontWeight: 900, lineHeight: 1, fontFamily: "monospace" }}>{minutaFmt}</div>
        </div>
      </div>

      {/* DATA / ORIGEM / DESTINO */}
      <div className="grid grid-cols-3" style={{ fontSize: "7pt", gap: "1mm" }}>
        <div>
          <div style={{ fontSize: "6pt", opacity: 0.6 }}>DATA</div>
          <div style={{ fontWeight: 700 }}>{data || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: "6pt", opacity: 0.6 }}>ORIGEM</div>
          <div style={{ fontWeight: 700 }}>{origem || "—"}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: "6pt", opacity: 0.6 }}>DESTINO</div>
          <div style={{ fontWeight: 700 }}>{destino || "—"}</div>
        </div>
      </div>

      {/* VOLUME — gigante */}
      <div
        className="text-center"
        style={{ background: "#000", color: "#fff", padding: "1.5mm 0", borderRadius: "1mm" }}
      >
        <div style={{ fontSize: "7pt", letterSpacing: "0.2em", opacity: 0.85 }}>VOLUME</div>
        <div style={{ fontSize: "36pt", fontWeight: 900, lineHeight: 0.95, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
          {String(numeroVol).padStart(2, "0")}<span style={{ opacity: 0.55 }}> / </span>{String(totalVol).padStart(2, "0")}
        </div>
      </div>

      {/* DESTINO BLOCO GRANDE */}
      <div style={{ background: "var(--pxlog-cyan, #19c4d8)", padding: "1.5mm 2mm", borderRadius: "1mm" }}>
        <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "0.15em", color: "#0a1f3d" }}>DESTINO</div>
        <div style={{ fontSize: "16pt", fontWeight: 900, lineHeight: 1, color: "#0a1f3d", textTransform: "uppercase" }}>
          {(cidadeDestino || destino) ?? "—"}{destino && cidadeDestino ? `/${destino}` : ""}
        </div>
      </div>

      {/* DESTINATÁRIO + ENDEREÇO */}
      <div style={{ fontSize: "7.5pt", lineHeight: 1.25 }}>
        <div style={{ fontSize: "6pt", opacity: 0.6, letterSpacing: "0.1em" }}>DESTINATÁRIO</div>
        <div style={{ fontWeight: 800, fontSize: "9pt", textTransform: "uppercase" }}>{destinatario || "—"}</div>
        {telefone && <div>Tel: {telefone}</div>}
        {enderecoLinha1 && <div>{enderecoLinha1}</div>}
        {enderecoLinha2 && <div>{enderecoLinha2}</div>}
      </div>

      {/* REMETENTE + CLIENTE compactos */}
      <div className="grid grid-cols-2" style={{ fontSize: "6.5pt", gap: "1mm", lineHeight: 1.2 }}>
        <div>
          <div style={{ fontSize: "5.5pt", opacity: 0.6, letterSpacing: "0.1em" }}>REMETENTE</div>
          <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{remetente || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: "5.5pt", opacity: 0.6, letterSpacing: "0.1em" }}>CLIENTE</div>
          <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{cliente || "—"}</div>
        </div>
      </div>

      {/* CARGA + STATUS */}
      <div className="flex items-stretch gap-1" style={{ fontSize: "6.5pt" }}>
        <div style={{ flex: 1, border: "0.2mm solid #000", padding: "1mm", borderRadius: "1mm" }}>
          <div style={{ fontSize: "5.5pt", opacity: 0.6, letterSpacing: "0.1em" }}>CARGA</div>
          <div className="grid grid-cols-2" style={{ gap: "0.5mm 2mm", lineHeight: 1.2 }}>
            <div>Real: <b>{Number(pesoReal ?? 0).toFixed(2)}kg</b></div>
            <div>Cub: <b>{Number(pesoCubado ?? 0).toFixed(2)}kg</b></div>
            <div>Tax: <b>{Number(pesoTaxado ?? 0).toFixed(2)}kg</b></div>
            <div>m³: <b>{Number(cubagem ?? 0).toFixed(3)}</b></div>
          </div>
          {tipoMercadoria && <div style={{ fontSize: "5.5pt", marginTop: "0.5mm" }}>Tipo: {tipoMercadoria}</div>}
        </div>
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ background: st.bg, color: st.fg, padding: "1mm 2mm", borderRadius: "1mm", minWidth: "22mm" }}
        >
          <div style={{ fontSize: "5.5pt", letterSpacing: "0.15em", opacity: 0.85 }}>STATUS</div>
          <div style={{ fontSize: "8pt", fontWeight: 900, lineHeight: 1 }}>{st.label}</div>
        </div>
      </div>

      {/* ROTA */}
      <div className="flex items-center justify-between" style={{ background: "#0a1f3d", color: "#fff", padding: "1mm 2mm", borderRadius: "1mm", fontSize: "6.5pt" }}>
        <div>
          <div style={{ fontSize: "5.5pt", opacity: 0.7, letterSpacing: "0.1em" }}>HUB ORIGEM</div>
          <div style={{ fontWeight: 800 }}>{hubOrigem || origem || "—"}</div>
        </div>
        <div style={{ fontSize: "10pt", opacity: 0.6 }}>→</div>
        <div className="text-center">
          <div style={{ fontSize: "5.5pt", opacity: 0.7, letterSpacing: "0.1em" }}>PRAZO</div>
          <div style={{ fontWeight: 800 }}>{prazoDias ? `${prazoDias}d` : "—"}</div>
        </div>
        <div style={{ fontSize: "10pt", opacity: 0.6 }}>→</div>
        <div className="text-right">
          <div style={{ fontSize: "5.5pt", opacity: 0.7, letterSpacing: "0.1em" }}>HUB DESTINO</div>
          <div style={{ fontWeight: 800 }}>{hubDestino || destino || "—"}</div>
        </div>
      </div>

      {/* FLAGS / OBSERVAÇÕES */}
      {flags.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: "0.8mm" }}>
          {flags.map((f) => {
            const fl = FLAG_STYLES[f];
            if (!fl) return null;
            return (
              <span key={f} style={{ background: fl.bg, color: "#fff", fontSize: "6pt", fontWeight: 800, padding: "0.5mm 1.5mm", borderRadius: "0.8mm", letterSpacing: "0.05em" }}>
                {fl.label}
              </span>
            );
          })}
        </div>
      )}

      {/* QR CODE */}
      <div className="flex items-center justify-center" style={{ paddingTop: "1mm" }}>
        <div style={{ background: "#fff", padding: "1mm", border: "0.2mm solid #000" }}>
          <QrSvg value={qrPayload} size={108} />
        </div>
      </div>

      {/* BARCODE + CÓDIGO HUMANO */}
      <div className="mt-auto" style={{ borderTop: "0.3mm solid #000", paddingTop: "1mm" }}>
        <Barcode value={codigo} height={42} />
        <div className="text-center font-mono" style={{ fontSize: "9pt", fontWeight: 700, letterSpacing: "0.1em", marginTop: "0.5mm" }}>
          {codigo}
        </div>
      </div>

      {/* RODAPÉ */}
      <div className="flex items-center justify-between" style={{ fontSize: "5.5pt", opacity: 0.7, borderTop: "0.2mm solid #000", paddingTop: "0.8mm" }}>
        <span>pxlog.com.br</span>
        <span>0800 000 0000</span>
        <span>Rastreio: app.pxlog.com.br/tracking</span>
      </div>
    </div>
  );
}
