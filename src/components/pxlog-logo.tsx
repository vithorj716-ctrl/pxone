import logoAsset from "@/assets/pxlog-logo.png.asset.json";

export function PxLogLogo({ className = "", height = 28 }: { className?: string; height?: number }) {
  return (
    <img
      src={logoAsset.url}
      alt="PXLog"
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}

export const PXLOG_LOGO_URL = logoAsset.url;
