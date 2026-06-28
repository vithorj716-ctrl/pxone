import * as React from "react";
import { cn } from "@/lib/utils";

export type NumericVariant = "currency" | "weight" | "volume" | "percent" | "integer" | "decimal";

type Props = Omit<React.ComponentProps<"input">, "type" | "value"> & {
  value: number | string | null | undefined;
  onValueChange?: (value: number | null, raw: string) => void;
  variant?: NumericVariant;
  decimals?: number;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
};

const VARIANT_DEFAULTS: Record<NumericVariant, { decimals: number; prefix?: string; suffix?: string }> = {
  currency: { decimals: 2, prefix: "R$ " },
  weight: { decimals: 3, suffix: " kg" },
  volume: { decimals: 3, suffix: " m³" },
  percent: { decimals: 2, suffix: " %" },
  integer: { decimals: 0 },
  decimal: { decimals: 2 },
};

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  // Remove anything that isn't digit, comma, dot, minus
  const cleaned = raw.replace(/[^\d,\-\.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number, decimals: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export const NumericInput = React.forwardRef<HTMLInputElement, Props>(function NumericInput(
  { value, onValueChange, variant = "decimal", decimals, min, max, suffix, prefix, className, onFocus, onBlur, onChange, disabled, readOnly, ...rest },
  ref,
) {
  const d = VARIANT_DEFAULTS[variant];
  const dec = decimals ?? d.decimals;
  const pfx = prefix ?? d.prefix ?? "";
  const sfx = suffix ?? d.suffix ?? "";

  const fmt = React.useCallback(
    (n: number | string | null | undefined): string => {
      if (n === null || n === undefined || n === "") return "";
      const num = typeof n === "number" ? n : parseNumber(String(n));
      if (num === null) return typeof n === "string" ? n : "";
      return `${pfx}${formatNumber(num, dec)}${sfx}`;
    },
    [dec, pfx, sfx],
  );

  const [display, setDisplay] = React.useState<string>(() => fmt(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDisplay(fmt(value));
  }, [value, focused, fmt]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      readOnly={readOnly}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        // Show raw editable number (no prefix/suffix, comma decimal)
        const num = parseNumber(display);
        setDisplay(num === null ? "" : formatNumber(num, dec).replace(/\./g, ""));
        // Select all for fast overwrite
        requestAnimationFrame(() => e.target.select());
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDisplay(raw);
        const num = parseNumber(raw);
        let clamped = num;
        if (clamped !== null) {
          if (typeof min === "number" && clamped < min) clamped = min;
          if (typeof max === "number" && clamped > max) clamped = max;
        }
        onValueChange?.(clamped, raw);
        onChange?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const num = parseNumber(display);
        if (num === null) {
          setDisplay("");
          onValueChange?.(null, "");
        } else {
          let clamped = num;
          if (typeof min === "number" && clamped < min) clamped = min;
          if (typeof max === "number" && clamped > max) clamped = max;
          setDisplay(fmt(clamped));
          onValueChange?.(clamped, String(clamped));
        }
        onBlur?.(e);
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm tabular-nums",
        className,
      )}
      {...rest}
    />
  );
});
