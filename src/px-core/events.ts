// PX Event Bus — barramento pub/sub leve.
// In-memory para reatividade imediata + persistência opcional em px_events.

import type { PxEvent, PxEventType } from "./types";

type Listener = (e: PxEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(tipo: PxEventType | "*", listener: Listener): () => void {
  const key = String(tipo);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => listeners.get(key)?.delete(listener);
}

export function emit(event: PxEvent) {
  listeners.get(event.tipo)?.forEach((l) => {
    try { l(event); } catch { /* noop */ }
  });
  listeners.get("*")?.forEach((l) => {
    try { l(event); } catch { /* noop */ }
  });
}
