import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrSvg({ value, size = 96 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 0, width: size, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value, size]);
  return <div className="inline-block" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Etiqueta térmica 100x150mm — uma por volume. */
export function QrLabel({
  codigo,
  numeroMinuta,
  numeroVol,
  totalVol,
  cliente,
  remetente,
  destinatario,
  origem,
  destino,
  cidadeDestino,
  peso,
  data,
}: {
  codigo: string;
  numeroMinuta: number | string;
  numeroVol: number;
  totalVol: number;
  cliente?: string | null;
  remetente?: string | null;
  destinatario?: string | null;
  origem?: string | null;
  destino?: string | null;
  cidadeDestino?: string | null;
  peso?: number | null;
  data?: string;
}) {
  return (
    <div className="tms-label bg-white text-black p-3 rounded ring-1 ring-black/20 print:ring-0 print:rounded-none flex flex-col gap-2"
      style={{ width: "100mm", minHeight: "150mm", fontFamily: "monospace", pageBreakAfter: "always" }}>
      <div className="flex items-start justify-between border-b border-black/30 pb-1">
        <div>
          <div className="text-[10px] uppercase tracking-wider">PXLog · Transfer Hub</div>
          <div className="text-xl font-bold leading-none">#{numeroMinuta}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase">Volume</div>
          <div className="text-2xl font-bold leading-none">{numeroVol}/{totalVol}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 text-xs">
          <div className="font-bold uppercase truncate">{destinatario || "—"}</div>
          <div className="truncate">{cidadeDestino || destino}</div>
        </div>
        <QrSvg value={codigo} size={88} />
      </div>

      <div className="text-[11px] space-y-0.5 flex-1">
        <div><span className="font-bold">DE:</span> {remetente || "—"} ({origem || "—"})</div>
        <div><span className="font-bold">PARA:</span> {destinatario || "—"} ({destino || "—"})</div>
        {cliente && <div><span className="font-bold">CLIENTE:</span> {cliente}</div>}
        {peso != null && <div><span className="font-bold">PESO:</span> {peso} kg</div>}
        {data && <div><span className="font-bold">DATA:</span> {data}</div>}
      </div>

      <div className="text-center font-mono text-[10px] tracking-wider border-t border-black/30 pt-1">
        {codigo}
      </div>
    </div>
  );
}
