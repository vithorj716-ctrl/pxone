// PXSales — transforma um registro bruto do XML em um cadastro de cliente completo.
// Precedência de valores: Receita Federal > campo estruturado do XML > texto livre extraído.

import type { ContatoNormalizado, EnderecoNormalizado, RegistroNormalizado, RegistroXml } from "./types";
import { campo, campos } from "./xml-parser";
import { isValidCnpj, onlyDigits } from "@/lib/cnpj";
import {
  chaveNome,
  classificarTemperatura,
  ehCelular,
  extrairCargo,
  extrairCep,
  extrairCidadeUf,
  extrairCnpjs,
  extrairConcorrente,
  extrairCpf,
  extrairDataMaisRecente,
  extrairEmails,
  extrairFrequencia,
  extrairInscricaoEstadual,
  extrairLogradouro,
  extrairNomeContato,
  extrairPrazoPagamento,
  extrairRotas,
  extrairSegmento,
  extrairTelefones,
  extrairTipoCarga,
  extrairUf,
  extrairValor,
  extrairVolumeMensal,
  nomeEmpresaValido,
  nomePessoaValido,
  hashTexto,
  limpar,
  paraNumero,
  titulo,
  UFS,
} from "./text-extract";

const TAGS_USADAS = new Set([
  "id","codigo","cnpj","cnpjs","cpf","empresa","razao_social","razaosocial","nome","nome_empresa","cliente",
  "nome_fantasia","fantasia","contato","contato_nome","responsavel","vendedor","cargo","funcao",
  "telefone","telefones","fone","celular","whatsapp","whats","email","e_mail","emails",
  "cep","logradouro","endereco","rua","numero","complemento","bairro","cidade","municipio","uf","estado",
  "observacoes","observacao","obs","anotacoes","notas","descricao","resumo","comentario",
  "segmento","ramo","atividade","tipo_carga","carga","rota","rotas","frequencia","volume","volume_mensal",
  "concorrente","potencial","valor","prazo","condicao_pagamento","data","data_visita","ultima_visita",
  "mensagem","mensagens","msg","message","conversa","historico","texto","fala","transcricao","situacao",
  "inscricao_estadual","ie","status","visitas","total_visitas",
]);

function textoCompleto(r: RegistroXml): string {
  return [r.texto, ...r.mensagens].join("\n");
}

function montarContatos(
  nomes: string[],
  telefones: string[],
  emails: string[],
  cargo: string | null,
  observacao: string | null,
): ContatoNormalizado[] {
  const out: ContatoNormalizado[] = [];
  const total = Math.max(nomes.length, telefones.length ? 1 : 0, emails.length ? 1 : 0);
  for (let i = 0; i < Math.max(total, 0); i++) {
    const telefone = telefones[i] ?? (i === 0 ? telefones[0] ?? null : null);
    const email = emails[i] ?? (i === 0 ? emails[0] ?? null : null);
    const nome = nomes[i] ?? (i === 0 ? "Contato comercial" : null);
    if (!nome && !telefone && !email) continue;
    out.push({
      nome: nome ?? "Contato comercial",
      cargo: i === 0 ? cargo : null,
      telefone: telefone ?? null,
      whatsapp: telefone && ehCelular(telefone) ? telefone : null,
      email: email ?? null,
      setor: "comercial",
      is_principal: i === 0,
      observacoes: i === 0 ? observacao : null,
    });
  }
  // telefones/e-mails sobrando viram contatos adicionais
  for (let i = out.length; i < Math.max(telefones.length, emails.length); i++) {
    const telefone = telefones[i] ?? null;
    const email = emails[i] ?? null;
    if (!telefone && !email) continue;
    out.push({
      nome: "Contato adicional",
      cargo: null,
      telefone,
      whatsapp: telefone && ehCelular(telefone) ? telefone : null,
      email,
      setor: "comercial",
      is_principal: false,
      observacoes: null,
    });
  }
  return out.slice(0, 10);
}

export function normalizarRegistro(r: RegistroXml): RegistroNormalizado {
  const texto = textoCompleto(r);
  const avisos: string[] = [];

  // ---- identificação
  const cnpjCampo = campos(r, "cnpj", "cnpjs", "documento", "doc").flatMap((v) => extrairCnpjs(v));
  const cnpjTexto = extrairCnpjs(texto);
  const todosCnpjs = Array.from(new Set([...cnpjCampo, ...cnpjTexto]));
  const cnpj = todosCnpjs[0] ?? null;
  const cnpjsAdicionais = todosCnpjs.slice(1);
  if (cnpjsAdicionais.length) avisos.push(`${cnpjsAdicionais.length} CNPJ(s) adicional(is) encontrado(s) — serão guardados como filiais no cadastro.`);

  const cnpjBrutoInvalido = campos(r, "cnpj").some((v) => onlyDigits(v).length === 14 && !isValidCnpj(v));
  if (!cnpj && cnpjBrutoInvalido) avisos.push("CNPJ informado no arquivo é inválido.");

  const razaoBruta = limpar(campo(r, "razao_social", "razaosocial", "empresa", "nome_empresa", "cliente", "nome"));
  const razao = nomeEmpresaValido(razaoBruta);
  if (razaoBruta && !razao) {
    avisos.push(
      cnpj
        ? "Nome da empresa no arquivo não é utilizável — será usado o nome oficial da Receita."
        : "Nome da empresa no arquivo não é utilizável — revise antes de importar.",
    );
  }
  const fantasia = nomeEmpresaValido(campo(r, "nome_fantasia", "fantasia", "apelido"));

  // ---- localização
  const cidadeCampo = limpar(campo(r, "cidade", "municipio"));
  const ufCampo = limpar(campo(r, "uf", "estado"));
  const cidadeUfTexto = extrairCidadeUf(texto);
  const uf = (ufCampo && UFS.includes(ufCampo.toUpperCase()) ? ufCampo.toUpperCase() : null) ?? cidadeUfTexto.uf ?? extrairUf(texto);
  const cidade = titulo(cidadeCampo) ?? cidadeUfTexto.cidade;

  const enderecoTexto = limpar(campo(r, "endereco", "logradouro", "rua")) ?? "";
  const partes = extrairLogradouro(enderecoTexto || texto);
  const cep = extrairCep(limpar(campo(r, "cep")) ?? "") ?? extrairCep(texto);

  const endereco: EnderecoNormalizado | null =
    cep || partes.logradouro || cidade
      ? {
          tipo: "comercial",
          apelido: "Endereço principal",
          cep,
          logradouro: limpar(campo(r, "logradouro", "rua")) ?? partes.logradouro,
          numero: limpar(campo(r, "numero")) ?? partes.numero,
          complemento: limpar(campo(r, "complemento")),
          bairro: limpar(campo(r, "bairro")) ?? partes.bairro,
          cidade,
          uf,
          observacoes: null,
        }
      : null;

  // ---- contatos
  // dígitos de latitude/longitude/mapa não são telefone, mesmo quando o arquivo os traz nessa tag
  const digitosGeo = campos(r, "latitude", "longitude", "maps_url", "localizacao", "coordenadas")
    .join(" ")
    .replace(/\D+/g, "");
  const ehGeo = (t: string) => digitosGeo.includes(t) || digitosGeo.includes(t.slice(0, 9));

  const telefones = Array.from(
    new Set([
      ...campos(r, "telefone", "telefones", "fone", "celular", "whatsapp", "whats").flatMap((v) => extrairTelefones(v)),
      ...extrairTelefones(texto),
    ]),
  )
    .filter((t) => !ehGeo(t))
    .slice(0, 8);
  const emails = Array.from(
    new Set([
      ...campos(r, "email", "e_mail", "emails").flatMap((v) => extrairEmails(v)),
      ...extrairEmails(texto),
    ]),
  ).slice(0, 8);

  const nomesContato = Array.from(
    new Set(
      [
        ...campos(r, "contato", "contato_nome", "responsavel_contato", "responsavel").map((v) => nomePessoaValido(v)),
        nomePessoaValido(extrairNomeContato(texto)),
      ].filter((v): v is string => !!v && v.length > 2),
    ),
  );
  const cargo = limpar(campo(r, "cargo", "funcao")) ?? extrairCargo(texto);

  const observacoes = limpar(
    campos(r, "observacoes", "observacao", "obs", "anotacoes", "notas", "descricao", "resumo", "comentario").join(" | "),
  );

  const contatos = montarContatos(nomesContato, telefones, emails, cargo, observacoes);

  // ---- inteligência comercial
  const segmento = limpar(campo(r, "segmento", "ramo", "atividade")) ?? extrairSegmento(texto);
  const tipoCarga = limpar(campo(r, "tipo_carga", "carga")) ?? extrairTipoCarga(texto);
  const rotas = Array.from(new Set([...campos(r, "rota", "rotas"), ...extrairRotas(texto)])).slice(0, 8);
  const frequencia = limpar(campo(r, "frequencia")) ?? extrairFrequencia(texto);
  const volumeMensal = limpar(campo(r, "volume", "volume_mensal")) ?? extrairVolumeMensal(texto);
  const concorrente = limpar(campo(r, "concorrente")) ?? extrairConcorrente(texto);
  const potencialCampo = limpar(campo(r, "potencial", "potencial_mensal", "valor"));
  const potencialMensal = (potencialCampo ? paraNumero(potencialCampo.replace(/[^\d.,]/g, "")) : null) ?? extrairValor(texto);
  const prazoPagamento =
    (limpar(campo(r, "prazo", "condicao_pagamento")) ? extrairPrazoPagamento(campo(r, "prazo", "condicao_pagamento") ?? "") : null) ??
    extrairPrazoPagamento(texto);
  const temperatura = classificarTemperatura(texto);

  const responsavel = limpar(campo(r, "responsavel", "vendedor", "consultor"));
  const ultimaVisita =
    extrairDataMaisRecente(campos(r, "data_visita", "ultima_visita", "data").join(" ")) ?? extrairDataMaisRecente(texto);
  const totalVisitas = Number(limpar(campo(r, "total_visitas", "visitas")) ?? 0) || (r.mensagens.length ? 1 : 0);

  const categorias = ["cliente"];
  if (!cnpj) categorias.push("prospect");

  // ---- campos não aproveitados (nada do XML é descartado)
  const extras: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(r.campos)) {
    if (TAGS_USADAS.has(k)) continue;
    if (!v.length) continue;
    extras[k] = v.slice(0, 5);
  }

  const observacoesComerciais = [
    segmento && `Segmento: ${segmento}`,
    tipoCarga && `Tipo de carga: ${tipoCarga}`,
    rotas.length && `Rotas: ${rotas.join(", ")}`,
    frequencia && `Frequência: ${frequencia}`,
    volumeMensal && `Volume: ${volumeMensal}`,
    concorrente && `Concorrente atual: ${concorrente}`,
    prazoPagamento != null && `Prazo negociado: ${prazoPagamento} dias`,
    ultimaVisita && `Última visita: ${ultimaVisita}`,
    responsavel && `Responsável comercial: ${responsavel}`,
    cnpjsAdicionais.length && `Outros CNPJs: ${cnpjsAdicionais.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  // ---- qualidade
  let score = 0;
  if (cnpj) score += 35;
  if (razao) score += 15;
  if (telefones.length) score += 15;
  if (emails.length) score += 10;
  if (cidade) score += 8;
  if (endereco?.logradouro) score += 7;
  if (contatos.length) score += 5;
  if (observacoes || r.mensagens.length) score += 5;
  score = Math.min(score, 100);

  if (!razao && !cnpj) avisos.push("Registro sem nome de empresa e sem CNPJ.");
  if (!telefones.length && !emails.length) avisos.push("Nenhum telefone ou e-mail encontrado.");

  const acaoSugerida: RegistroNormalizado["acaoSugerida"] = cnpj
    ? "criar"
    : razao && (telefones.length || emails.length)
      ? "lead"
      : "revisao";

  return {
    xmlId: r.xmlId,
    xmlIds: [r.xmlId],
    registroHash: hashTexto(`${cnpj ?? chaveNome(razao) ?? r.xmlId}|${telefones[0] ?? ""}|${emails[0] ?? ""}`),
    cnpj,
    cnpjsAdicionais,
    cpf: extrairCpf(texto),
    inscricaoEstadual: limpar(campo(r, "inscricao_estadual", "ie")) ?? extrairInscricaoEstadual(texto),
    razaoSocial: razao ? { valor: razao, origem: campo(r, "razao_social", "empresa") ? "xml" : "texto" } : null,
    nomeFantasia: fantasia ? { valor: fantasia, origem: "xml" } : null,
    situacaoCadastral: null,
    endereco,
    enderecosAdicionais: [],
    contatos,
    telefones,
    emails,
    segmento,
    tipoCarga,
    rotas,
    frequencia,
    volumeMensal,
    concorrente,
    potencialMensal,
    prazoPagamento,
    temperatura,
    categorias,
    responsavel,
    ultimaVisita,
    totalVisitas,
    totalMensagens: r.totalMensagens,
    observacoes: [observacoes, r.mensagens.slice(-12).join("\n")].filter(Boolean).join("\n\n") || null,
    observacoesComerciais: observacoesComerciais || null,
    extras,
    score,
    avisos,
    acaoSugerida,
  };
}

export function normalizarArquivo(registros: RegistroXml[]): RegistroNormalizado[] {
  return registros.map(normalizarRegistro);
}
