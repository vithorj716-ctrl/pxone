// SDK PX Comercial (CRM). PX Comercial é Master Data de clientes, contatos,
// tabelas de frete, cotações, propostas e regras comerciais.

import { pxRequest } from "./client";
import { PX_INTEGRATION_CACHE_TTL_MS } from "./config";

type Envelope<T> = { status?: string; data: T };

export type CrmCliente = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  ativo: boolean;
  [k: string]: unknown;
};

export type CrmTabelaFrete = {
  id: string;
  nome: string;
  vigente: boolean;
  vigencia_inicio?: string;
  vigencia_fim?: string | null;
  regras: unknown;
  [k: string]: unknown;
};

export type CrmCotacao = {
  id: string;
  cliente_id: string;
  status: string;
  valor_total: number;
  [k: string]: unknown;
};

export const crm = {
  async listClientes(params: { search?: string; cursor?: string; limit?: number } = {}) {
    const res = await pxRequest<Envelope<{ items: CrmCliente[]; next_cursor?: string | null }>>("pxcrm", {
      path: "/clientes",
      query: { search: params.search, cursor: params.cursor, limit: params.limit ?? 50 },
      cache: { key: `crm:clientes:${JSON.stringify(params)}`, ttlMs: 30_000 },
    });
    return res.data;
  },

  async getCliente(id: string) {
    const res = await pxRequest<Envelope<CrmCliente>>("pxcrm", {
      path: `/clientes/${encodeURIComponent(id)}`,
      cache: { key: `crm:cliente:${id}`, ttlMs: PX_INTEGRATION_CACHE_TTL_MS },
    });
    return res.data;
  },

  async upsertCliente(payload: Partial<CrmCliente> & { cnpj: string }, idempotencyKey?: string) {
    const res = await pxRequest<Envelope<CrmCliente>>("pxcrm", {
      method: "POST",
      path: "/clientes",
      body: payload,
      idempotencyKey,
    });
    return res.data;
  },

  async listTabelasFrete() {
    const res = await pxRequest<Envelope<{ items: CrmTabelaFrete[] }>>("pxcrm", {
      path: "/tabelas-frete",
      query: { vigente: "true" },
      cache: { key: "crm:tabelas-frete:vigentes", ttlMs: 60_000 },
    });
    return res.data.items;
  },

  async getTabelaFrete(id: string) {
    const res = await pxRequest<Envelope<CrmTabelaFrete>>("pxcrm", {
      path: `/tabelas-frete/${encodeURIComponent(id)}`,
      cache: { key: `crm:tabela-frete:${id}`, ttlMs: 60_000 },
    });
    return res.data;
  },

  async getCotacao(id: string) {
    const res = await pxRequest<Envelope<CrmCotacao>>("pxcrm", {
      path: `/cotacoes/${encodeURIComponent(id)}`,
    });
    return res.data;
  },

  async pipelineResumo() {
    const res = await pxRequest<Envelope<Record<string, number>>>("pxcrm", {
      path: "/pipeline/resumo",
      cache: { key: "crm:pipeline:resumo", ttlMs: 30_000 },
    });
    return res.data;
  },
};
