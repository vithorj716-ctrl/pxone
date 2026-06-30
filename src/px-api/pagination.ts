// PX API — Paginação padrão.

export type PxPageMeta = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type PxPaged<T> = {
  items: T[];
  meta: PxPageMeta;
};

export function parsePagination(url: URL, opts?: { defaultSize?: number; maxSize?: number }): {
  page: number; pageSize: number; from: number; to: number;
} {
  const defSize = opts?.defaultSize ?? 25;
  const maxSize = opts?.maxSize ?? 100;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const requested = Number(url.searchParams.get("pageSize") ?? `${defSize}`) || defSize;
  const pageSize = Math.min(maxSize, Math.max(1, requested));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export function makeMeta(page: number, pageSize: number, total: number): PxPageMeta {
  return {
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}
