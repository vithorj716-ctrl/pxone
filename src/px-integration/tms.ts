// SDK PX Log (TMS). PX Log é Master Data de solicitações, embarques, viagens,
// entregas, tracking, ocorrências e financeiro operacional.

import { pxRequest } from "./client";

type Envelope<T> = { status?: string; data: T };

export type TmsOperacao = {
  id: string;
  numero: string;
  cliente_id: string;
  cotacao_id?: string | null;
  status: string;
  valor_frete: number;
  [k: string]: unknown;
};

export type TmsFaturamento = {
  operacao_id: string;
  cliente_id: string;
  valor: number;
  data_faturamento: string;
  vencimento?: string | null;
  status: string;
};

export const tms = {
  async listOperacoes(params: { status?: string; cursor?: string; limit?: number } = {}) {
    const res = await pxRequest<Envelope<{ items: TmsOperacao[]; next_cursor?: string | null }>>("pxlog", {
      path: "/operacoes",
      query: { status: params.status, cursor: params.cursor, limit: params.limit ?? 50 },
      cache: { key: `tms:operacoes:${JSON.stringify(params)}`, ttlMs: 15_000 },
    });
    return res.data;
  },

  async getOperacao(id: string) {
    const res = await pxRequest<Envelope<TmsOperacao>>("pxlog", {
      path: `/operacoes/${encodeURIComponent(id)}`,
    });
    return res.data;
  },

  async listFaturamento(params: { de?: string; ate?: string; cursor?: string; limit?: number } = {}) {
    const res = await pxRequest<Envelope<{ items: TmsFaturamento[]; next_cursor?: string | null }>>("pxlog", {
      path: "/financeiro/faturamento",
      query: { de: params.de, ate: params.ate, cursor: params.cursor, limit: params.limit ?? 100 },
      cache: { key: `tms:faturamento:${JSON.stringify(params)}`, ttlMs: 30_000 },
    });
    return res.data;
  },

  async kpisOperacionais() {
    const res = await pxRequest<Envelope<Record<string, number>>>("pxlog", {
      path: "/dashboard/kpis",
      cache: { key: "tms:kpis", ttlMs: 30_000 },
    });
    return res.data;
  },
};
