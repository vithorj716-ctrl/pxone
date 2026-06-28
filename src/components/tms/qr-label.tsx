import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { PXLOG_LOGO_URL } from "@/components/pxlog-logo";

export function QrSvg({ value, size = 96 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 0, width: size, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value, size]);
  return <div style={{ width: size, height: size, display: "inline-block" }} dangerouslySetInnerHTML={{ __html: svg }} />;
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
  return <svg ref={ref} style={{ width: "100%", height, display: "block" }} />;
}

const FLAG_LABEL: Record<string, string> = {
  fragil: "FRÁGIL",
  empilhar: "EMPILHAR",
  nao_empilhar: "NÃO EMPILHAR",
  urgente: "URGENTE",
  medicamento: "MEDICAMENTO",
  controlado: "CONTROLADO",
  refrigerado: "REFRIGERADO",
  inflamavel: "INFLAMÁVEL",
};

export type QrLabelProps = {
  /** Código interno do volume (CODE128 — somente operação). Ex: PXLOG-00015487-003 */
  codigo: string;
  /** Token público único para rastreamento. Use UUID do volume, NUNCA ID sequencial. */
  publicToken: string;
  numeroMinuta: number | string;
  numeroVol: number;
  totalVol: number;

  cliente?: string | null;
  remetente?: string | null;
  remetenteTel?: string | null;
  destinatario?: string | null;
  telefone?: string | null;

  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidadeDestino?: string | null;
  ufDestino?: string | null;
  cep?: string | null;
  origem?: string | null;

  pesoReal?: number | null;
  pesoCubado?: number | null;
  pesoTaxado?: number | null;

  flags?: string[];

  data?: string;
};

/** Etiqueta logística horizontal 100×100mm — térmica, B&W, alta densidade operacional. */
export function QrLabel(props: QrLabelProps) {
  const {
    codigo,
    publicToken,
    numeroMinuta,
    numeroVol,
    totalVol,
    remetente,
    remetenteTel,
    destinatario,
    telefone,
    rua,
    numero,
    bairro,
    cidadeDestino,
    ufDestino,
    cep,
    origem,
    pesoReal,
    pesoCubado,
    pesoTaxado,
    flags = [],
    data,
  } = props;

  const minutaFmt = String(numeroMinuta).padStart(8, "0");
  const trackingUrl = `https://tracking.pxlog.com.br/r/${publicToken}`;
  const destinoTxt = [cidadeDestino, ufDestino].filter(Boolean).join("/").toUpperCase() || "—";
  const enderecoLinha = [rua, numero && `nº ${numero}`].filter(Boolean).join(", ");
  const cidadeLinha = [bairro, [cidadeDestino, ufDestino].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  const obsTxt = flags.map((f) => FLAG_LABEL[f] ?? f.toUpperCase()).join(" | ");

  return (
    <div
      className="tms-label"
      style={{
        width: "100mm",
        height: "100mm",
        background: "#fff",
        color: "#000",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        pageBreakAfter: "always",
        boxSizing: "border-box",
        padding: "2.5mm",
        border: "0.4mm solid #000",
        display: "flex",
        flexDirection: "column",
        lineHeight: 1.15,
      }}
    >
      {/* CABEÇALHO: logo · minuta · volume */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "0.4mm solid #000",
          paddingBottom: "1.5mm",
          gap: "2mm",
        }}
      >
        <img src={PXLOG_LOGO_URL} alt="PXLog" style={{ height: "6mm", width: "auto" }} />
        <div style={{ fontSize: "8pt", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.05em" }}>
          MINUTA {minutaFmt}
        </div>
        <div style={{ fontSize: "11pt", fontWeight: 900, letterSpacing: "0.03em" }}>
          VOLUME {String(numeroVol).padStart(2, "0")}/{String(totalVol).padStart(2, "0")}
        </div>
      </div>

      {/* DESTINO — informação dominante */}
      <div style={{ padding: "1.5mm 0 1mm", borderBottom: "0.3mm solid #000" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: "6pt", fontWeight: 700, letterSpacing: "0.12em" }}>DESTINO</div>
          <div style={{ fontSize: "6pt", fontWeight: 700, letterSpacing: "0.08em" }}>
            ORIGEM: <span style={{ fontSize: "7.5pt" }}>{(origem || "—").toUpperCase()}</span>
          </div>
        </div>
        <div style={{ fontSize: "22pt", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.01em" }}>
          {destinoTxt}
        </div>
      </div>

      {/* DESTINATÁRIO */}
      <div style={{ padding: "1.2mm 0", borderBottom: "0.3mm solid #000", fontSize: "7.5pt" }}>
        <div style={{ fontSize: "5.5pt", fontWeight: 700, letterSpacing: "0.12em" }}>DESTINATÁRIO</div>
        <div style={{ fontSize: "9pt", fontWeight: 900, textTransform: "uppercase", lineHeight: 1.1 }}>
          {destinatario || "—"}
        </div>
        {telefone && <div style={{ fontSize: "7pt" }}>TEL: {telefone}</div>}
        {enderecoLinha && <div style={{ fontSize: "7pt", textTransform: "uppercase" }}>{enderecoLinha}</div>}
        {(cidadeLinha || cep) && (
          <div style={{ fontSize: "7pt", textTransform: "uppercase" }}>
            {cidadeLinha}
            {cidadeLinha && cep && " — "}
            {cep && `CEP ${cep}`}
          </div>
        )}
      </div>

      {/* REMETENTE + CARGA */}
      <div style={{ padding: "1.2mm 0", borderBottom: "0.3mm solid #000", fontSize: "7pt" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "5.5pt", fontWeight: 700, letterSpacing: "0.1em" }}>REMETENTE: </span>
            <span style={{ fontWeight: 800, textTransform: "uppercase" }}>{remetente || "—"}</span>
            {remetenteTel && <span> · TEL {remetenteTel}</span>}
          </div>
          {data && <div style={{ fontSize: "6.5pt", whiteSpace: "nowrap" }}>{data}</div>}
        </div>
        <div style={{ marginTop: "0.6mm", fontWeight: 700, letterSpacing: "0.02em" }}>
          PESO: <b>{Number(pesoReal ?? 0).toFixed(1)}kg</b>{"   "}
          CUBADO: <b>{Number(pesoCubado ?? 0).toFixed(1)}kg</b>{"   "}
          TAXADO: <b>{Number(pesoTaxado ?? 0).toFixed(1)}kg</b>{"   "}
          VOL: <b>{String(numeroVol).padStart(2, "0")}/{String(totalVol).padStart(2, "0")}</b>
        </div>
      </div>

      {/* OBSERVAÇÃO — só se houver */}
      {obsTxt && (
        <div
          style={{
            padding: "1mm 1.5mm",
            borderBottom: "0.3mm solid #000",
            background: "#000",
            color: "#fff",
            fontSize: "8pt",
            fontWeight: 900,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          {obsTxt}
        </div>
      )}

      {/* RODAPÉ: barcode (operação) + QR (rastreamento público) */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", gap: "2mm", paddingTop: "1.5mm" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Barcode value={codigo} height={48} />
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "9pt",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textAlign: "center",
              marginTop: "0.5mm",
            }}
          >
            {codigo}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <QrSvg value={trackingUrl} size={72} />
          <div style={{ fontSize: "4.8pt", marginTop: "0.3mm", letterSpacing: "0.05em" }}>RASTREIE</div>
        </div>
      </div>
    </div>
  );
}
