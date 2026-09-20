import logoAsset from "@/assets/px-grupo-logo.png.asset.json";
import logoLightAsset from "@/assets/px-grupo-logo-light.png.asset.json";

/**
 * Logo institucional do Grupo PX — usada em toda a plataforma.
 * Em fundos escuros usa a versão clara, para nunca ficar invisível.
 */
export function PxGrupoLogo({
  className = "",
  height = 28,
  onDark = false,
}: {
  className?: string;
  height?: number;
  /** Força a versão clara (para cabeçalhos/áreas escuras em qualquer tema). */
  onDark?: boolean;
}) {
  const style = { height, width: "auto" } as const;

  if (onDark) {
    return (
      <img
        src={logoLightAsset.url}
        alt="Grupo PX"
        style={style}
        className={className}
        draggable={false}
      />
    );
  }

  return (
    <>
      <img
        src={logoAsset.url}
        alt="Grupo PX"
        style={style}
        className={`block dark:hidden ${className}`}
        draggable={false}
      />
      <img
        src={logoLightAsset.url}
        alt=""
        aria-hidden="true"
        style={style}
        className={`hidden dark:block ${className}`}
        draggable={false}
      />
    </>
  );
}

export const PX_LOGO_URL = logoAsset.url;
export const PX_LOGO_LIGHT_URL = logoLightAsset.url;
