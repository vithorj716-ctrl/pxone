// Helpers do TMS — cálculos de cubagem, peso taxado, lookup de tabela de frete.
// Tudo client-side. Nenhuma dependência server.

export const CUBAGEM_FATOR = 6000; // cm³ por kg (padrão rodoviário fracionado)

export function calcCubagem(altura_cm: number, largura_cm: number, comprimento_cm: number, qtd = 1) {
  const v = (Number(altura_cm || 0) * Number(largura_cm || 0) * Number(comprimento_cm || 0) * qtd) / 1_000_000;
  return Math.round(v * 1000) / 1000; // m³
}

export function calcPesoCubado(cubagem_m3: number) {
  // 1 m³ = 300 kg cubado (padrão fracionado BR), pode ser parametrizado depois
  return Math.round(Number(cubagem_m3 || 0) * 300 * 100) / 100;
}

export function calcPesoTaxado(peso_real: number, peso_cubado: number) {
  return Math.max(Number(peso_real || 0), Number(peso_cubado || 0));
}

// Motor comercial único — toda tela/serviço calcula por aqui.
export {
  calcularTabelaFrete,
  regrasLegado,
  escolherTabela,
  type RegraComercial,
  type ContextoFrete,
  type ResultadoFrete,
} from "@/pxlog/regra-engine";
import { calcularTabelaFrete, regrasLegado, escolherTabela, type ContextoFrete, type RegraComercial } from "@/pxlog/regra-engine";

export type RegraFrete = {
  cliente_id?: string | null;
  origem?: string | null;
  destino?: string | null;
  tipo_cobranca: string;
  valor_coleta: number;
  valor_entrega: number;
  valor_kg: number;
  valor_m3: number;
  valor_minimo: number;
  faixa_peso_min?: number | null;
  faixa_peso_max?: number | null;
  faixa_cubagem_min?: number | null;
  faixa_cubagem_max?: number | null;
  prazo_dias: number;
};

/** Tabela comercial: cabeçalho legado + regras estruturadas (quando já cadastradas). */
export type TabelaComercial = RegraFrete & { id?: string; nome?: string; ativo?: boolean; regras?: RegraComercial[] };

/** Regras efetivas da tabela: as estruturadas quando existirem, senão a conversão do legado. */
export function regrasDaTabela(tabela: TabelaComercial | null | undefined): RegraComercial[] {
  if (!tabela) return [];
  if (tabela.regras && tabela.regras.length) return tabela.regras;
  return regrasLegado(tabela as unknown as Record<string, unknown>);
}

export function escolherRegra(opts: {
  regras: TabelaComercial[];
  cliente_id?: string | null;
  origem?: string | null;
  destino?: string | null;
  peso_taxado: number;
  cubagem: number;
}) {
  return escolherTabela(opts.regras as any[], {
    cliente_id: opts.cliente_id,
    origem: opts.origem,
    destino: opts.destino,
    peso_taxado: opts.peso_taxado,
    cubagem: opts.cubagem,
  });
}

/** Cálculo detalhado pelo motor único. */
export function calcularFreteDaTabela(tabela: TabelaComercial | null, ctx: ContextoFrete) {
  return calcularTabelaFrete(regrasDaTabela(tabela), ctx);
}

/** Compatibilidade: valor total do frete pela mesma engine. */
export function calcValorFrete(
  tabela: TabelaComercial | null,
  peso_taxado: number,
  cubagem: number,
  extra: Partial<ContextoFrete> = {},
) {
  if (!tabela) return 0;
  return calcularFreteDaTabela(tabela, { peso_taxado, peso: peso_taxado, cubagem, ...extra }).total;
}

/** Código único do volume — usado como QR/barras. */
export function codigoVolume(numeroMinuta: number | string, numeroVol: number) {
  const m = String(numeroMinuta).padStart(7, "0");
  const v = String(numeroVol).padStart(3, "0");
  return `PXLOG-${m}-${v}`;
}

export const STATUS_VOL_LABEL: Record<string, { label: string; cor: string }> = {
  solicitado: { label: "Solicitado", cor: "bg-slate-500/15 text-slate-300" },
  coleta_programada: { label: "Coleta programada", cor: "bg-amber-500/15 text-amber-300" },
  coletado: { label: "Coletado", cor: "bg-amber-500/15 text-amber-300" },
  recebido_hub_origem: { label: "No HUB origem", cor: "bg-sky-500/15 text-sky-300" },
  conferido: { label: "Conferido", cor: "bg-sky-500/15 text-sky-300" },
  etiquetado: { label: "Etiquetado", cor: "bg-sky-500/15 text-sky-300" },
  embarcado: { label: "Embarcado", cor: "bg-indigo-500/15 text-indigo-300" },
  em_transferencia: { label: "Em transferência", cor: "bg-indigo-500/15 text-indigo-300" },
  recebido_hub_destino: { label: "HUB destino", cor: "bg-violet-500/15 text-violet-300" },
  separado: { label: "Separado", cor: "bg-violet-500/15 text-violet-300" },
  em_rota: { label: "Em rota", cor: "bg-cyan-500/15 text-cyan-300" },
  saiu_entrega: { label: "Saiu para entrega", cor: "bg-cyan-500/15 text-cyan-300" },
  entregue: { label: "Entregue", cor: "bg-emerald-500/15 text-emerald-300" },
  ocorrencia: { label: "Ocorrência", cor: "bg-rose-500/15 text-rose-300" },
  devolucao: { label: "Devolução", cor: "bg-rose-500/15 text-rose-300" },
};

export const EVENTOS_ORDENADOS: { tipo: string; label: string }[] = [
  { tipo: "solicitado", label: "Solicitado" },
  { tipo: "coleta_programada", label: "Coleta programada" },
  { tipo: "coletado", label: "Coletado" },
  { tipo: "recebido_hub_origem", label: "Recebido HUB origem" },
  { tipo: "conferido", label: "Conferido" },
  { tipo: "etiquetado", label: "Etiquetado" },
  { tipo: "embarcado", label: "Embarcado" },
  { tipo: "em_transferencia", label: "Em transferência" },
  { tipo: "recebido_hub_destino", label: "Recebido HUB destino" },
  { tipo: "separado", label: "Separado" },
  { tipo: "em_rota", label: "Em rota" },
  { tipo: "saiu_entrega", label: "Saiu para entrega" },
  { tipo: "entregue", label: "Entregue" },
];
