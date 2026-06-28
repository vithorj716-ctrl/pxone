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
        width: 1.4,
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
  coleta_programada: { label: "COLETA PROG.", bg: "#d97706", fg: "#ffffff" },
  coletado: { label: "COLETADO", bg: "#d97706", fg: "#ffffff" },
  recebido_hub_origem: { label: "NO HUB", bg: "#0284c7", fg: "#ffffff" },
  conferido: { label: "CONFERIDO", bg: "#0284c7", fg: "#ffffff" },
  etiquetado: { label: "ETIQUETADO", bg: "#0284c7", fg: "#ffffff" },
  embarcado: { label: "EMBARCADO", bg: "#4f46e5", fg: "#ffffff" },
  em_transferencia: { label: "TRANSF.", bg: "#4f46e5", fg: "#ffffff" },
  recebido_hub_destino: { label: "HUB DEST.", bg: "#7c3aed", fg: "#ffffff" },
  separado: { label: "SEPARADO", bg: "#7c3aed", fg: "#ffffff" },
  em_rota: { label: "EM ROTA", bg: "#0891b2", fg: "#ffffff" },
  saiu_entrega: { label: "EM ROTA", bg: "#0891b2", fg: "#ffffff" },
  entregue: { label: "ENTREGUE", bg: "#059669", fg: "#ffffff" },
};

const FLAG_STYLES: Record<string, { label: string; bg: string }> = {
  fragil: { label: "FRÁGIL", bg: "#dc2626" },
  empilhar: { label: "EMPILHAR", bg: "#0284c7" },
  nao_empilhar: { label: "N/EMPILHAR", bg: "#dc2626" },
  urgente: { label: "URGENTE", bg: "#dc2626" },
  medicamento: { label: "MEDIC.", bg: "#059669" },
  controlado: { label: "CONTROL.", bg: "#7c3aed" },
  refrigerado: { label: "REFRIG.", bg: "#0891b2" },
  inflamavel: { label: "INFLAM.", bg: "#ea580c" },
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

  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidadeDestino?: string | null;
  cep?: string | null;
  origem?: string | null;
  destino?: string | null;

  pesoReal?: number | null;
  pesoCubado?: number | null;
  pesoTaxado?: number | null;
  cubagem?: number | null;
  tipoMercadoria?: string | null;

  hubOrigem?: string | null;
  hubDestino?: string | null;
  prazoDias?: number | null;

  data?: string;
  trackingUrl?: string;
};

/** Etiqueta logística compacta 100x100mm — otimizada para colagem em caixas. */
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
  const enderecoLinha2 = [bairro, cep && `CEP ${cep}`].filter(Boolean).join(" · ");

  return (
    <div
      className="tms-label bg-white text-black flex flex-col font-sans"
      style={{
        width: "100mm",
        height: "100mm",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        pageBreakAfter: "always",
        boxSizing: "border-box",
        padding: "2mm",
        gap: "1mm",
        border: "0.3mm solid #000",
      }}
    >
      {/* CABEÇALHO compacto: logo · minuta · data */}
      <div className="flex items-center justify-between" style={{ borderBottom: "0.25mm solid #000", paddingBottom: "1mm" }}>
        <img src={PXLOG_LOGO_URL} alt="PXLog" style={{ height: "5mm", width: "auto" }} />
        <div className="text-right" style={{ lineHeight: 1 }}>
          <span style={{ fontSize: "5.5pt", opacity: 0.65, letterSpacing: "0.08em" }}>MINUTA </span>
          <span style={{ fontSize: "9pt", fontWeight: 900, fontFamily: "monospace" }}>{minutaFmt}</span>
          <div style={{ fontSize: "5.5pt", opacity: 0.65, marginTop: "0.3mm" }}>{data || ""}</div>
        </div>
      </div>

      {/* LINHA 1: VOLUME (esquerda) + DESTINO (direita) */}
      <div className="flex" style={{ gap: "1mm" }}>
        <div
          className="text-center flex flex-col justify-center"
          style={{ background: "#000", color: "#fff", padding: "1mm", borderRadius: "0.8mm", width: "28mm" }}
        >
          <div style={{ fontSize: "5.5pt", letterSpacing: "0.15em", opacity: 0.8 }}>VOLUME</div>
          <div style={{ fontSize: "22pt", fontWeight: 900, lineHeight: 0.95 }}>
            {String(numeroVol).padStart(2, "0")}<span style={{ opacity: 0.5, fontSize: "14pt" }}>/{String(totalVol).padStart(2, "0")}</span>
          </div>
        </div>
        <div
          className="flex-1 flex flex-col justify-center"
          style={{ background: "var(--pxlog-cyan, #19c4d8)", padding: "1mm 1.5mm", borderRadius: "0.8mm", color: "#0a1f3d" }}
        >
          <div style={{ fontSize: "5.5pt", fontWeight: 700, letterSpacing: "0.12em" }}>DESTINO</div>
          <div style={{ fontSize: "13pt", fontWeight: 900, lineHeight: 1, textTransform: "uppercase" }}>
            {(cidadeDestino || destino) ?? "—"}{destino && cidadeDestino ? `/${destino}` : ""}
          </div>
          <div style={{ fontSize: "5.5pt", fontWeight: 700, marginTop: "0.3mm", opacity: 0.8 }}>
            ORIGEM: {origem || "—"}
          </div>
        </div>
      </div>

      {/* DESTINATÁRIO + ENDEREÇO */}
      <div style={{ fontSize: "6.5pt", lineHeight: 1.2, borderBottom: "0.2mm dashed #999", paddingBottom: "0.8mm" }}>
        <div style={{ fontSize: "5.5pt", opacity: 0.65, letterSpacing: "0.08em" }}>DESTINATÁRIO</div>
        <div style={{ fontWeight: 800, fontSize: "8pt", textTransform: "uppercase", lineHeight: 1.1 }}>{destinatario || "—"}</div>
        {(enderecoLinha1 || enderecoLinha2 || telefone) && (
          <div style={{ marginTop: "0.3mm" }}>
            {enderecoLinha1 && <span>{enderecoLinha1}</span>}
            {enderecoLinha1 && enderecoLinha2 && <span> · </span>}
            {enderecoLinha2 && <span>{enderecoLinha2}</span>}
            {telefone && <span> · Tel: {telefone}</span>}
          </div>
        )}
      </div>

      {/* REMETENTE · CLIENTE · STATUS na mesma linha */}
      <div className="flex items-stretch" style={{ gap: "1mm", fontSize: "5.5pt", lineHeight: 1.15 }}>
        <div style={{ flex: 1 }}>
          <div style={{ opacity: 0.6, letterSpacing: "0.08em" }}>REMETENTE</div>
          <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "6.5pt" }}>{remetente || "—"}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ opacity: 0.6, letterSpacing: "0.08em" }}>CLIENTE</div>
          <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "6.5pt" }}>{cliente || "—"}</div>
        </div>
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ background: st.bg, color: st.fg, padding: "0.5mm 1.5mm", borderRadius: "0.8mm", minWidth: "20mm" }}
        >
          <div style={{ fontSize: "4.8pt", letterSpacing: "0.1em", opacity: 0.85 }}>STATUS</div>
          <div style={{ fontSize: "7pt", fontWeight: 900, lineHeight: 1 }}>{st.label}</div>
        </div>
      </div>

      {/* CARGA + ROTA compactos */}
      <div className="flex" style={{ gap: "1mm", fontSize: "5.5pt" }}>
        <div style={{ flex: 1, border: "0.2mm solid #000", padding: "0.8mm", borderRadius: "0.8mm" }}>
          <div style={{ opacity: 0.6, letterSpacing: "0.08em" }}>CARGA</div>
          <div style={{ lineHeight: 1.2 }}>
            R: <b>{Number(pesoReal ?? 0).toFixed(1)}kg</b> · C: <b>{Number(pesoCubado ?? 0).toFixed(1)}kg</b> · T: <b>{Number(pesoTaxado ?? 0).toFixed(1)}kg</b> · m³: <b>{Number(cubagem ?? 0).toFixed(3)}</b>
          </div>
        </div>
        <div className="flex items-center" style={{ background: "#0a1f3d", color: "#fff", padding: "0.5mm 1.5mm", borderRadius: "0.8mm", gap: "1.5mm" }}>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: "4.5pt", opacity: 0.7 }}>ROTA</div>
            <div style={{ fontWeight: 800, fontSize: "6pt" }}>
              {hubOrigem || origem || "—"} → {hubDestino || destino || "—"}
            </div>
          </div>
          {prazoDias != null && (
            <div className="text-center" style={{ borderLeft: "0.2mm solid rgba(255,255,255,0.3)", paddingLeft: "1.5mm" }}>
              <div style={{ fontSize: "4.5pt", opacity: 0.7 }}>PRAZO</div>
              <div style={{ fontWeight: 800, fontSize: "7pt" }}>{prazoDias}d</div>
            </div>
          )}
        </div>
      </div>

      {/* FLAGS */}
      {flags.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: "0.6mm" }}>
          {flags.map((f) => {
            const fl = FLAG_STYLES[f];
            if (!fl) return null;
            return (
              <span key={f} style={{ background: fl.bg, color: "#fff", fontSize: "5pt", fontWeight: 800, padding: "0.3mm 1.2mm", borderRadius: "0.6mm", letterSpacing: "0.05em" }}>
                {fl.label}
              </span>
            );
          })}
        </div>
      )}

      {/* QR + BARCODE lado a lado (rodapé) */}
      <div className="mt-auto flex items-end" style={{ gap: "1.5mm", borderTop: "0.25mm solid #000", paddingTop: "1mm" }}>
        <div style={{ background: "#fff", padding: "0.5mm", border: "0.2mm solid #000" }}>
          <QrSvg value={qrPayload} size={76} />
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <Barcode value={codigo} height={30} />
          <div className="text-center font-mono" style={{ fontSize: "7pt", fontWeight: 700, letterSpacing: "0.08em", marginTop: "0.3mm" }}>
            {codigo}
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: "4.5pt", opacity: 0.7, marginTop: "0.5mm" }}>
            <span>pxlog.com.br</span>
            <span>app.pxlog.com.br/tracking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
