import logoAsset from "@/assets/px-grupo-logo.png.asset.json";

/** Logo institucional do Grupo PX — usada em toda a plataforma. */
export function PxGrupoLogo({ className = "", height = 28 }: { className?: string; height?: number }) {
  return (
    <img
      src={logoAsset.url}
      alt="Grupo PX"
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}

export const PX_LOGO_URL = logoAsset.url;
