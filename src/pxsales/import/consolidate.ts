// PXSales — consolidação dos registros do próprio arquivo.
// O XML vem de visitas: a mesma empresa aparece várias vezes. Aqui elas viram UM cliente.

import type { ContatoNormalizado, RegistroNormalizado } from "./types";
import { chaveNome, hashTexto } from "./text-extract";

function chaves(r: RegistroNormalizado): string[] {
  const out: string[] = [];
  if (r.cnpj) out.push(`cnpj:${r.cnpj}`);
  for (const c of r.cnpjsAdicionais) out.push(`cnpj:${c}`);
  for (const t of r.telefones) out.push(`tel:${t}`);
  for (const e of r.emails) out.push(`mail:${e}`);
  const nome = chaveNome(r.razaoSocial?.valor ?? r.nomeFantasia?.valor ?? "");
  if (nome.length >= 5) out.push(`nome:${nome}${r.endereco?.uf ? `:${r.endereco.uf}` : ""}`);
  return out;
}

function mesclarContatos(a: ContatoNormalizado[], b: ContatoNormalizado[]): ContatoNormalizado[] {
  const out = [...a];
  for (const c of b) {
    const igual = out.find(
      (x) =>
        (c.telefone && x.telefone === c.telefone) ||
        (c.email && x.email === c.email) ||
        (c.nome && x.nome?.toLowerCase() === c.nome.toLowerCase()),
    );
    if (igual) {
      igual.telefone ??= c.telefone;
      igual.whatsapp ??= c.whatsapp;
      igual.email ??= c.email;
      igual.cargo ??= c.cargo;
      continue;
    }
    out.push({ ...c, is_principal: false });
  }
  if (out.length && !out.some((c) => c.is_principal)) out[0]!.is_principal = true;
  return out.slice(0, 12);
}

function unir<T>(a: T[], b: T[]): T[] {
  return Array.from(new Set([...a, ...b]));
}

function mesclar(base: RegistroNormalizado, novo: RegistroNormalizado): RegistroNormalizado {
  const principal = novo.score > base.score ? novo : base;
  const outro = principal === base ? novo : base;

  const maisRecente = [base.ultimaVisita, novo.ultimaVisita].filter(Boolean).sort().at(-1) ?? null;

  return {
    ...principal,
    xmlIds: unir(base.xmlIds, novo.xmlIds),
    cnpj: principal.cnpj ?? outro.cnpj,
    cnpjsAdicionais: unir(base.cnpjsAdicionais, novo.cnpjsAdicionais).filter((c) => c !== (principal.cnpj ?? outro.cnpj)),
    cpf: principal.cpf ?? outro.cpf,
    inscricaoEstadual: principal.inscricaoEstadual ?? outro.inscricaoEstadual,
    razaoSocial: principal.razaoSocial ?? outro.razaoSocial,
    nomeFantasia: principal.nomeFantasia ?? outro.nomeFantasia,
    endereco: principal.endereco ?? outro.endereco,
    enderecosAdicionais:
      principal.endereco && outro.endereco && principal.endereco.cep !== outro.endereco.cep && outro.endereco.cep
        ? [...principal.enderecosAdicionais, outro.endereco]
        : principal.enderecosAdicionais,
    contatos: mesclarContatos(principal.contatos, outro.contatos),
    telefones: unir(principal.telefones, outro.telefones).slice(0, 10),
    emails: unir(principal.emails, outro.emails).slice(0, 10),
    segmento: principal.segmento ?? outro.segmento,
    tipoCarga: principal.tipoCarga ?? outro.tipoCarga,
    rotas: unir(principal.rotas, outro.rotas).slice(0, 10),
    frequencia: principal.frequencia ?? outro.frequencia,
    volumeMensal: principal.volumeMensal ?? outro.volumeMensal,
    concorrente: principal.concorrente ?? outro.concorrente,
    potencialMensal: principal.potencialMensal ?? outro.potencialMensal,
    prazoPagamento: principal.prazoPagamento ?? outro.prazoPagamento,
    temperatura: principal.temperatura ?? outro.temperatura,
    responsavel: principal.responsavel ?? outro.responsavel,
    ultimaVisita: maisRecente,
    totalVisitas: base.totalVisitas + novo.totalVisitas,
    totalMensagens: base.totalMensagens + novo.totalMensagens,
    observacoes: [principal.observacoes, outro.observacoes].filter(Boolean).join("\n\n---\n\n") || null,
    observacoesComerciais: principal.observacoesComerciais ?? outro.observacoesComerciais,
    extras: { ...outro.extras, ...principal.extras },
    score: Math.max(base.score, novo.score),
    avisos: unir(base.avisos, novo.avisos),
    acaoSugerida: principal.acaoSugerida,
  };
}

/** Agrupa registros do mesmo arquivo que representam a mesma empresa. */
export function consolidar(registros: RegistroNormalizado[]): RegistroNormalizado[] {
  const porChave = new Map<string, number>();
  const grupos: RegistroNormalizado[] = [];

  for (const r of registros) {
    const ks = chaves(r);
    let alvo: number | null = null;
    for (const k of ks) {
      const idx = porChave.get(k);
      if (idx != null) {
        alvo = idx;
        break;
      }
    }
    if (alvo == null) {
      grupos.push(r);
      alvo = grupos.length - 1;
    } else {
      grupos[alvo] = mesclar(grupos[alvo]!, r);
    }
    for (const k of chaves(grupos[alvo]!)) porChave.set(k, alvo);
  }

  return grupos.map((g) => ({
    ...g,
    registroHash: hashTexto(
      `${g.cnpj ?? chaveNome(g.razaoSocial?.valor ?? "")}|${g.telefones[0] ?? ""}|${g.emails[0] ?? ""}`,
    ),
    avisos: g.xmlIds.length > 1 ? [...g.avisos, `${g.xmlIds.length} visitas do arquivo consolidadas neste cliente.`] : g.avisos,
  }));
}
