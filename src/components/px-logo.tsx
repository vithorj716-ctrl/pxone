import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import logoAsset from "@/assets/px-grupo-logo.png.asset.json";
import logoLightAsset from "@/assets/px-grupo-logo-light.png.asset.json";
import "./px-logo.css";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
let scrollTriggerRegistered = false;

function registerScrollTrigger() {
  if (typeof window !== "undefined" && !scrollTriggerRegistered) {
    gsap.registerPlugin(ScrollTrigger);
    scrollTriggerRegistered = true;
  }
}

export type PXLogoProps = {
  className?: string;
  /** Largura da logo em pixels. */
  size?: number;
  /** Executa a sequência de entrada da marca. */
  animate?: boolean;
  /** Ativa a resposta sutil ao ponteiro em dispositivos compatíveis. */
  hover?: boolean;
  /** Ativa o parallax sutil com ScrollTrigger. */
  scroll?: boolean;
  /** @deprecated Use `size`. Mantido para compatibilidade com os shells existentes. */
  height?: number;
  /** @deprecated A marca mantém sempre suas cores oficiais. */
  onDark?: boolean;
  /** @deprecated Use `scroll`. */
  animateOnScroll?: boolean;
  /** @deprecated Use `hover`. */
  enableHover?: boolean;
  /** @deprecated Use `scroll`. */
  enableParallax?: boolean;
};

/** Logo vetorial oficial do Grupo PX, com animação de identidade isolada por instância. */
export function PXLogo({
  className = "",
  size,
  animate = true,
  hover,
  scroll,
  height,
  onDark: _onDark = false,
  animateOnScroll,
  enableHover,
  enableParallax,
}: PXLogoProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const shouldHover = hover ?? enableHover ?? true;
  const shouldScroll = scroll ?? (animateOnScroll !== false && enableParallax !== false);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    registerScrollTrigger();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const tablet = window.matchMedia("(max-width: 1023px)").matches;
    const p = root.querySelector<SVGPathElement>('[data-logo-part="p"]');
    const xParts = gsap.utils.toArray<SVGPathElement>(root.querySelectorAll('[data-logo-part^="x-"]'));
    const letters = ["g", "r", "u", "p", "o"]
      .map((letter) => root.querySelector<SVGPathElement>(`[data-logo-part="letter-${letter}"]`))
      .filter((letter): letter is SVGPathElement => Boolean(letter));
    const stage = root.querySelector<SVGGElement>('[data-logo-part="stage"]');
    const parallaxLayer = root.querySelector<SVGGElement>('[data-logo-part="parallax"]');
    const wordmark = root.querySelector<SVGGElement>('[data-logo-part="wordmark"]');
    if (!p || xParts.length !== 3 || letters.length !== 5 || !stage || !parallaxLayer || !wordmark) return;

    const context = gsap.context(() => {
      gsap.set([p, ...xParts, wordmark, stage, parallaxLayer], { transformOrigin: "50% 50%", transformBox: "fill-box" });

      if (reducedMotion || !animate) {
        gsap.set([p, ...xParts, wordmark, stage, parallaxLayer], { clearProps: "all" });
      } else {
        const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
        timeline
          .set([p, ...xParts, wordmark], { xPercent: mobile ? -72 : -101, willChange: "transform" })
          .to(p, { xPercent: 0, duration: mobile ? 0.7 : 1, ease: "power2.out" })
          .to(
            xParts,
            {
              xPercent: 0,
              duration: mobile ? 0.7 : 1,
              stagger: mobile ? 0.055 : 0.08,
              ease: "power2.out",
            },
            "-=0.65",
          )
          .to(wordmark, { xPercent: 0, duration: mobile ? 0.65 : 0.9, ease: "power2.out" }, "-=0.45")
          .set([p, ...xParts, wordmark], { clearProps: "willChange" });
      }

      if (!reducedMotion && shouldScroll) {
        gsap.fromTo(
          parallaxLayer,
          { y: mobile ? -4 : -9, rotation: mobile ? -0.2 : -0.5 },
          {
            y: mobile ? 4 : 9,
            rotation: mobile ? 0.2 : 0.5,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top bottom",
              end: "bottom top",
              scrub: mobile ? 1.5 : 1.2,
              invalidateOnRefresh: true,
            },
          },
        );
      }
    }, root);

    const cleanups: Array<() => void> = [];
    if (!reducedMotion && shouldHover && finePointer) {
      const intensity = tablet ? 0.6 : 1;
      const xTo = gsap.quickTo(root, "x", { duration: 0.32, ease: "power2.out" });
      const yTo = gsap.quickTo(root, "y", { duration: 0.32, ease: "power2.out" });
      const rotationXTo = gsap.quickTo(root, "rotationX", { duration: 0.32, ease: "power2.out" });
      const rotationYTo = gsap.quickTo(root, "rotationY", { duration: 0.32, ease: "power2.out" });

      const enter = () => gsap.to(root, { scale: 1.022, duration: 0.34, ease: "power2.out", overwrite: "auto" });
      const move = (event: PointerEvent) => {
        const bounds = root.getBoundingClientRect();
        const nx = (event.clientX - bounds.left) / bounds.width - 0.5;
        const ny = (event.clientY - bounds.top) / bounds.height - 0.5;
        xTo(nx * 6 * intensity);
        yTo(ny * 6 * intensity);
        rotationXTo(-ny * 6 * intensity);
        rotationYTo(nx * 6 * intensity);
      };
      const leave = () => gsap.to(root, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, duration: 0.48, ease: "power3.out", overwrite: "auto" });
      root.addEventListener("pointerenter", enter);
      root.addEventListener("pointermove", move);
      root.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        root.removeEventListener("pointerenter", enter);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerleave", leave);
      });
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      gsap.killTweensOf(root);
      context.revert();
    };
  }, [animate, shouldHover, shouldScroll]);

  const resolvedHeight = size ? size / 1.5 : (height ?? 28);
  const style = {
    "--px-logo-width": `${size ?? resolvedHeight * 1.5}px`,
    "--px-logo-height": `${resolvedHeight}px`,
  } as CSSProperties;

  return (
    <span ref={rootRef} className={`px-logo ${className}`} style={style} data-px-logo data-animate={animate ? "true" : "false"}>
      <svg
        className="px-logo__svg"
        version="1.0"
        xmlns="http://www.w3.org/2000/svg"
        width="1536.000000pt"
        height="1024.000000pt"
        viewBox="0 0 1536.000000 1024.000000"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grupo PX"
      >
        <g data-logo-part="parallax">
          <g data-logo-part="stage">
            <g
              transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)"
              stroke="none"
            >
            <g data-logo-part="symbol">
           <g fill="#052849">
          <path data-logo-part="p" d="M5696 7153 c-3 -10 -23 -106 -45 -213 -45 -221 -154 -751 -201 -975 -50 -243 -165 -799 -256 -1245 -47 -228 -88 -427 -91 -442 l-5 -28 380 0 381 0 7 38 c3 20 15 77 25 125 11 48 53 251 94 450 41 199 77 372 80 385 l5 22 438 0 c490 0 628 8 793 44 254 55 411 137 569 295 190 190 284 426 296 741 8 188 -13 301 -82 439 -105 211 -289 328 -580 366 -95 12 -265 15 -959 15 -795 0 -844 -1 -849 -17z m1587 -523 c67 -17 137 -67 167 -120 23 -41 25 -55 25 -165 -1 -85 -6 -137 -19 -179 -43 -144 -121 -249 -225 -304 -109 -58 -141 -62 -623 -62 -241 0 -438 1 -438 3 0 24 168 826 176 839 9 15 874 4 937 -12z" />
           </g>
           <g fill="#00C3E6">
          <path data-logo-part="x-left" d="M7984 7154 c3 -8 48 -86 100 -172 51 -86 209 -352 351 -590 142 -238 262 -431 266 -430 16 6 559 463 559 471 0 8 -53 97 -349 585 l-93 152 -420 0 c-379 0 -420 -2 -414 -16z" />
          <path data-logo-part="x-core" d="M9756 6794 c-208 -206 -507 -497 -665 -646 -366 -347 -1055 -1017 -1561 -1517 l-395 -390 473 0 473 -1 312 303 c348 337 657 632 882 842 83 77 224 210 315 295 91 86 314 295 495 465 182 170 447 420 590 555 143 136 311 293 373 349 61 57 112 107 112 112 0 5 -214 9 -512 9 l-513 -1 -379 -375z" />
          <path data-logo-part="x-right" d="M9588 5522 c-187 -161 -324 -281 -383 -335 -50 -45 -50 -46 -34 -74 9 -15 86 -143 171 -283 85 -140 200 -329 255 -420 l100 -165 432 -3 c237 -1 431 0 431 3 0 3 -11 22 -24 43 -13 20 -197 327 -410 682 -212 355 -389 650 -394 657 -5 8 -49 -24 -144 -105z" />
           </g>
            </g>
             <g data-logo-part="wordmark" fill="#052849">
          <path data-logo-part="letter-g" d="M6215 3997 c-125 -41 -163 -92 -205 -271 -38 -164 -23 -232 58 -269 40 -18 66 -22 177 -22 115 0 136 3 180 23 86 40 112 73 140 182 9 36 18 73 21 83 5 16 -6 17 -130 17 l-135 0 -10 -37 c-20 -71 -18 -75 44 -71 30 1 55 -1 55 -5 0 -19 -35 -66 -56 -76 -66 -30 -164 -19 -185 21 -19 35 14 219 49 280 45 78 223 73 234 -6 3 -19 10 -21 87 -24 l84 -3 -6 50 c-13 108 -58 134 -237 138 -83 2 -138 -2 -165 -10z" />
           <path data-logo-part="letter-o" d="M8705 4003 c-86 -19 -151 -66 -184 -132 -27 -54 -64 -215 -63 -278 1 -69 20 -99 88 -133 44 -22 61 -25 164 -25 68 0 134 6 163 14 62 18 129 78 155 139 31 70 66 254 57 299 -10 54 -59 98 -123 112 -51 11 -216 13 -257 4z m195 -118 c26 -23 26 -65 0 -173 -24 -102 -42 -138 -78 -156 -41 -20 -112 -27 -152 -13 -53 19 -59 48 -32 175 24 117 41 148 93 175 44 24 139 19 169 -8z" />
           <path data-logo-part="letter-r" d="M6730 3998 c0 -3 -29 -127 -65 -277 -36 -150 -65 -275 -65 -277 0 -2 36 -4 79 -4 89 0 81 -8 102 95 15 74 23 85 64 85 29 0 65 -24 65 -44 0 -4 17 -36 37 -71 l37 -65 89 0 89 0 -21 33 c-27 40 -83 148 -79 151 2 1 22 10 45 20 52 23 76 48 102 106 46 105 34 192 -31 227 -28 15 -63 18 -240 21 -115 2 -208 2 -208 0z m309 -109 c28 -10 31 -15 31 -52 0 -90 -51 -127 -177 -127 -50 0 -63 3 -63 15 0 14 25 127 36 163 4 15 128 17 173 1z" />
           <path data-logo-part="letter-u" d="M7300 3828 c-53 -219 -59 -281 -30 -326 11 -18 37 -40 58 -49 56 -24 213 -29 291 -9 129 33 153 70 216 336 25 107 48 201 50 208 3 9 -17 12 -79 12 l-83 0 -32 -147 c-51 -234 -66 -280 -101 -298 -16 -8 -53 -15 -83 -15 -99 0 -105 30 -52 262 20 84 38 163 40 176 5 21 3 22 -74 22 l-79 0 -42 -172z" />
           <path data-logo-part="letter-p" d="M7950 3908 c-12 -51 -37 -158 -56 -238 -19 -80 -38 -164 -41 -187 l-6 -43 76 0 76 0 10 38 c6 20 11 42 11 47 0 6 5 26 10 46 l10 37 123 4 c178 6 228 33 272 152 26 68 25 137 -1 173 -39 52 -62 58 -270 61 l-192 4 -22 -94z m330 -36 c15 -18 16 -29 8 -64 -5 -23 -14 -49 -21 -57 -21 -25 -75 -41 -141 -41 l-64 0 15 58 c8 31 19 74 24 96 l10 38 76 -4 c63 -3 78 -7 93 -26z" />
            </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

export const PxGrupoLogo = PXLogo;

// Mantidos para integrações externas que ainda referenciam os assets legados.
export const PX_LOGO_URL = logoAsset.url;
export const PX_LOGO_LIGHT_URL = logoLightAsset.url;
