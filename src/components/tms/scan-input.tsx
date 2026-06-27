import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";

export function ScanInput({
  onScan,
  placeholder = "Bipe o código do volume…",
  autoFocus = true,
}: {
  onScan: (code: string) => void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
    function refocus() { ref.current?.focus(); }
    window.addEventListener("focus", refocus);
    return () => window.removeEventListener("focus", refocus);
  }, [autoFocus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    setValue("");
    await onScan(code);
    ref.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-brand pointer-events-none" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full pl-10 pr-4 py-4 text-base sm:text-lg font-mono bg-surface ring-1 ring-border rounded-xl focus:ring-2 focus:ring-brand focus:outline-none"
      />
    </form>
  );
}
