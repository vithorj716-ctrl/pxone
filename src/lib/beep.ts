// Áudio sintético para feedback do operador (sem assets).
let ctx: AudioContext | null = null;
function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

export function playBeep(kind: "ok" | "erro" | "duplicado" = "ok") {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);

  if (kind === "ok") {
    o.type = "sine";
    o.frequency.setValueAtTime(880, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.start(now); o.stop(now + 0.15);
  } else {
    // erro / duplicado: dois tons graves, ~600ms
    o.type = "square";
    o.frequency.setValueAtTime(220, now);
    o.frequency.setValueAtTime(160, now + 0.18);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    o.start(now); o.stop(now + 0.6);
  }
}
