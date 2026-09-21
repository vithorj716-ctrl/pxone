// PXSales — importação em massa de clientes a partir de XML de visitas.
// Reutiliza o cadastro único (PX Registry), os contatos, os endereços e os leads já existentes.
// Nenhuma base paralela de clientes é criada.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCnpj, onlyDigits } from "./cnpj";
import { assertPermissao, auditar, escopoEmpresas, resolveEmpresaId } from "./pxsales-guard";
import { chaveNome } from "@/pxsales/import/text-extract";
import type { ConflitoCampo, MatchRegistro, RegistroNormalizado, ResultadoItem } from "@/pxsales/import/types";

type Sb = any;

const CAMPOS_COMPARAVEIS: { campo: string; label: string }[] = [
  { campo: "razao_social", label: "Razão social" },
  { campo: "nome_fantasia", label: "Nome fantasia" },
  { campo: "telefone", label: "Telefone" },
  { campo: "email", label: "E-mail" },
  { campo: "cidade", label: "Cidade" },
  { campo: "uf", label: "UF" },
  { campo: "cep", label: "CEP" },
];

function valorDoRegistro(r: RegistroNormalizado, campo: string): string | null {
  switch (campo) {
    case "razao_social":
      return r.razaoSocial?.valor ?? null;
    case "nome_fantasia":
      return r.nomeFantasia?.valor ?? r.razaoSocial?.valor ?? null;
    case "telefone":
      return r.telefones[0] ?? null;
    case "email":
      return r.emails[0] ?? null;
    case "cidade":
      return r.endereco?.cidade ?? null;
    case "uf":
      return r.endereco?.uf ?? null;
    case "cep":
      return r.endereco?.cep ?? null;
    default:
      return null;
  }
}

function conflitosCom(atual: any, r: RegistroNormalizado): ConflitoCampo[] {
  const out: ConflitoCampo[] = [];
  for (const { campo } of CAMPOS_COMPARAVEIS) {
    const novo = valorDoRegistro(r, campo);
    const velho = atual?.[campo] ?? null;
    if (!novo || !velho) continue;
    if (String(novo).trim().toLowerCase() === String(velho).trim().toLowerCase()) continue;
    out.push({ campo, atual: String(velho), novo: String(novo), origem: "xml" });
  }
  return out;
}

/** Só preenche o que está vazio na base — nunca apaga dado bom com dado pior. */
function preencherLacunas(atual: any, novos: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const [k, v] of Object.entries(novos)) {
    if (v == null || v === "") continue;
    const cur = atual?.[k];
    if (cur == null || cur === "") patch[k] = v;
  }
  return patch;
}

function dadosCliente(r: RegistroNormalizado) {
  return {
    razao_social: r.razaoSocial?.valor ?? null,
    nome_fantasia: r.nomeFantasia?.valor ?? r.razaoSocial?.valor ?? null,
    situacao_cadastral: r.situacaoCadastral?.valor ?? null,
    cep: r.endereco?.cep ?? null,
    logradouro: r.endereco?.logradouro ?? null,
    numero: r.endereco?.numero ?? null,
    complemento: r.endereco?.complemento ?? null,
    bairro: r.endereco?.bairro ?? null,
    cidade: r.endereco?.cidade ?? null,
    uf: r.endereco?.uf ?? null,
    contato_nome: r.contatos[0]?.nome ?? null,
    contato_cargo: r.contatos[0]?.cargo ?? null,
    telefone: r.telefones[0] ?? null,
    whatsapp: r.contatos.find((c) => c.whatsapp)?.whatsapp ?? null,
    email: r.emails[0] ?? null,
    observacoes: r.observacoes ?? null,
    observacoes_comerciais: r.observacoesComerciais ?? null,
    prazo_padrao_dias: r.prazoPagamento ?? null,
  };
}

async function gravarContatos(sb: Sb, userId: string, clienteId: string, r: RegistroNormalizado) {
  if (!r.contatos.length) return 0;
  const { data: existentes } = await sb
    .from("px_registry_contatos")
    .select("id,nome,telefone,email,is_principal")
    .eq("cliente_id", clienteId);
  const atuais = (existentes ?? []) as any[];
  const temPrincipal = atuais.some((c) => c.is_principal);

  const novos: any[] = [];
  for (const c of r.contatos) {
    const dup = atuais.find(
      (x) =>
        (c.telefone && onlyDigits(x.telefone ?? "") === onlyDigits(c.telefone)) ||
        (c.email && (x.email ?? "").toLowerCase() === c.email.toLowerCase()) ||
        (c.nome && (x.nome ?? "").toLowerCase() === c.nome.toLowerCase()),
    );
    if (dup) continue;
    novos.push({
      cliente_id: clienteId,
      setor: c.setor,
      nome: c.nome ?? "Contato comercial",
      cargo: c.cargo,
      telefone: c.telefone,
      whatsapp: c.whatsapp,
      email: c.email,
      is_principal: !temPrincipal && !novos.length,
      observacoes: c.observacoes,
      created_by: userId,
      updated_by: userId,
    });
  }
  if (!novos.length) return 0;
  const { error } = await sb.from("px_registry_contatos").insert(novos);
  if (error) throw new Error(`contatos: ${error.message}`);
  return novos.length;
}

async function gravarEnderecos(sb: Sb, userId: string, clienteId: string, r: RegistroNormalizado) {
  const lista = [r.endereco, ...r.enderecosAdicionais].filter(Boolean) as NonNullable<typeof r.endereco>[];
  const uteis = lista.filter((e) => e.cep || e.logradouro);
  if (!uteis.length) return 0;

  const { data: existentes } = await sb
    .from("px_registry_enderecos")
    .select("id,cep,numero,logradouro")
    .eq("cliente_id", clienteId);
  const atuais = (existentes ?? []) as any[];

  const novos = uteis
    .filter(
      (e) =>
        !atuais.some(
          (x) =>
            (e.cep && onlyDigits(x.cep ?? "") === onlyDigits(e.cep) && (x.numero ?? "") === (e.numero ?? "")) ||
            (e.logradouro && (x.logradouro ?? "").toLowerCase() === e.logradouro.toLowerCase()),
        ),
    )
    .map((e, i) => ({
      cliente_id: clienteId,
      tipo: e.tipo ?? "comercial",
      apelido: e.apelido ?? "Endereço importado",
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cidade: e.cidade,
      uf: e.uf,
      observacoes: e.observacoes,
      is_padrao_remetente: false,
      is_padrao_destinatario: i === 0 && !atuais.length,
      ativo: true,
      created_by: userId,
      updated_by: userId,
    }));

  if (!novos.length) return 0;
  const { error } = await sb.from("px_registry_enderecos").insert(novos);
  if (error) throw new Error(`endereços: ${error.message}`);
  return novos.length;
}

async function registrarVisita(
  sb: Sb,
  userId: string,
  empresaId: string,
  alvo: { clienteId?: string | null; leadId?: string | null },
  r: RegistroNormalizado,
) {
  if (!r.totalVisitas && !r.totalMensagens) return;
  try {
    await sb.from("pxsales_atividades").insert({
      tipo: "visita",
      assunto: `Histórico importado — ${r.totalVisitas || 1} visita(s)`,
      descricao: [r.observacoesComerciais, r.observacoes].filter(Boolean).join("\n\n")?.slice(0, 8000) ?? null,
      cliente_id: alvo.clienteId ?? null,
      lead_id: alvo.leadId ?? null,
      responsavel_id: userId,
      prevista_para: r.ultimaVisita ? `${r.ultimaVisita}T12:00:00Z` : null,
      concluida: true,
      concluida_em: r.ultimaVisita ? `${r.ultimaVisita}T12:00:00Z` : new Date().toISOString(),
      resultado: "Importado do histórico comercial (XML de visitas).",
      empresa_id: empresaId,
      created_by: userId,
      updated_by: userId,
    });
  } catch {
    /* histórico é complementar: nunca derruba a importação */
  }
}

// ---------------------------------------------------------------- análise

export const analisarRegistrosImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      empresa_id?: string | null;
      registros: { xmlId: string; registroHash?: string; cnpj: string | null; telefones: string[]; emails: string[]; nome: string | null }[];
    }) => {
      if (!Array.isArray(d?.registros)) throw new Error("registros obrigatórios");
      if (d.registros.length > 600) throw new Error("Envie no máximo 600 registros por análise.");
      return d;
    },
  )
  .handler(async ({ data, context }): Promise<MatchRegistro[]> => {
    const sb = context.supabase as Sb;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id ?? null);

    const cnpjs = Array.from(new Set(data.registros.map((r) => r.cnpj).filter(Boolean))) as string[];
    const telefones = Array.from(new Set(data.registros.flatMap((r) => r.telefones))).slice(0, 1500);
    const emails = Array.from(new Set(data.registros.flatMap((r) => r.emails))).slice(0, 1500);

    const [porCnpj, porTelefone, porEmail, todosNomes, jaImportados] = await Promise.all([
      cnpjs.length
        ? sb.from("px_registry_clientes").select("*").in("cnpj", cnpjs)
        : Promise.resolve({ data: [] }),
      telefones.length
        ? sb.from("px_registry_clientes").select("*").in("telefone", telefones)
        : Promise.resolve({ data: [] }),
      emails.length ? sb.from("px_registry_clientes").select("*").in("email", emails) : Promise.resolve({ data: [] }),
      sb.from("px_registry_clientes").select("id,cnpj,razao_social,nome_fantasia,cidade,uf,telefone,email,ativo").limit(5000),
      sb
        .from("pxsales_importacao_itens")
        .select("registro_hash")
        .in("empresa_id", empresas.length ? empresas : ["00000000-0000-0000-0000-000000000000"])
        .eq("status", "ok")
        .limit(5000),
    ]);

    const mapaCnpj = new Map<string, any>();
    for (const c of (porCnpj.data ?? []) as any[]) mapaCnpj.set(c.cnpj, c);
    const mapaTel = new Map<string, any>();
    for (const c of (porTelefone.data ?? []) as any[]) if (c.telefone) mapaTel.set(onlyDigits(c.telefone), c);
    const mapaMail = new Map<string, any>();
    for (const c of (porEmail.data ?? []) as any[]) if (c.email) mapaMail.set(c.email.toLowerCase(), c);
    const mapaNome = new Map<string, any>();
    for (const c of (todosNomes.data ?? []) as any[]) {
      const k = chaveNome(c.razao_social ?? c.nome_fantasia ?? "");
      if (k.length >= 5 && !mapaNome.has(k)) mapaNome.set(k, c);
    }
    const hashesOk = new Set(((jaImportados.data ?? []) as any[]).map((i) => i.registro_hash));

    return data.registros.map((r): MatchRegistro => {
      let achado: any = null;
      let motivo: MatchRegistro["motivo"] = null;
      if (r.cnpj && mapaCnpj.has(r.cnpj)) {
        achado = mapaCnpj.get(r.cnpj);
        motivo = "cnpj";
      }
      if (!achado) {
        for (const t of r.telefones) {
          if (mapaTel.has(onlyDigits(t))) {
            achado = mapaTel.get(onlyDigits(t));
            motivo = "telefone";
            break;
          }
        }
      }
      if (!achado) {
        for (const e of r.emails) {
          if (mapaMail.has(e.toLowerCase())) {
            achado = mapaMail.get(e.toLowerCase());
            motivo = "email";
            break;
          }
        }
      }
      if (!achado && r.nome) {
        const k = chaveNome(r.nome);
        if (k.length >= 5 && mapaNome.has(k)) {
          achado = mapaNome.get(k);
          motivo = "nome";
        }
      }

      return {
        xmlId: r.xmlId,
        clienteId: achado?.id ?? null,
        leadId: null,
        motivo,
        clienteResumo: achado
          ? {
              id: achado.id,
              cnpj: achado.cnpj,
              razao_social: achado.razao_social ?? null,
              nome_fantasia: achado.nome_fantasia ?? null,
              cidade: achado.cidade ?? null,
              uf: achado.uf ?? null,
              telefone: achado.telefone ?? null,
              email: achado.email ?? null,
              ativo: achado.ativo !== false,
            }
          : null,
        conflitos: [],
        jaImportado: !!r.registroHash && hashesOk.has(r.registroHash),
      };
    });
  });

// ---------------------------------------------------------------- importação

export const criarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { empresa_id?: string | null; arquivo_nome: string; arquivo_hash: string; total: number; metadados?: any }) => {
    if (!d?.arquivo_nome || !d?.arquivo_hash) throw new Error("Arquivo inválido.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.import");
    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id ?? null);

    const { data: row, error } = await sb
      .from("pxsales_importacoes")
      .insert({
        empresa_id: empresaId,
        arquivo_nome: data.arquivo_nome,
        arquivo_hash: data.arquivo_hash,
        origem: "xml_visitas",
        total_registros: data.total,
        metadados: data.metadados ?? {},
        created_by: userId,
      })
      .select("id,empresa_id")
      .single();
    if (error) throw new Error(error.message);

    const { data: anteriores } = await sb
      .from("pxsales_importacoes")
      .select("id,created_at,criados,atualizados")
      .eq("empresa_id", empresaId)
      .eq("arquivo_hash", data.arquivo_hash)
      .neq("id", row.id)
      .order("created_at", { ascending: false })
      .limit(1);

    await auditar(sb, userId, "pxsales_importacoes", row.id, "iniciar", {
      arquivo: data.arquivo_nome,
      total: data.total,
    });

    return {
      importacaoId: row.id as string,
      empresaId: empresaId as string,
      reimportacao: !!(anteriores ?? []).length,
      importacaoAnterior: (anteriores ?? [])[0] ?? null,
    };
  });

export const importarLoteClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      importacao_id: string;
      empresa_id?: string | null;
      registros: RegistroNormalizado[];
      sobrescrever?: boolean;
      criarLeadSemCnpj?: boolean;
    }) => {
      if (!d?.importacao_id) throw new Error("importacao_id obrigatório");
      if (!Array.isArray(d?.registros) || !d.registros.length) throw new Error("Nenhum registro no lote.");
      if (d.registros.length > 25) throw new Error("Envie no máximo 25 registros por lote.");
      return d;
    },
  )
  .handler(async ({ data, context }): Promise<ResultadoItem[]> => {
    const sb = context.supabase as Sb;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.import");
    const empresaId = await resolveEmpresaId(sb, userId, data.empresa_id ?? null);

    const { data: imp } = await sb
      .from("pxsales_importacoes")
      .select("id,empresa_id,status")
      .eq("id", data.importacao_id)
      .maybeSingle();
    if (!imp) throw new Error("Importação não encontrada.");
    if (imp.empresa_id !== empresaId) throw new Error("Esta importação pertence a outra empresa do grupo.");
    if (imp.status !== "processando") throw new Error("Esta importação já foi encerrada.");

    const hashes = data.registros.map((r) => r.registroHash);
    const { data: jaOk } = await sb
      .from("pxsales_importacao_itens")
      .select("registro_hash,cliente_id,lead_id")
      .eq("empresa_id", empresaId)
      .eq("status", "ok")
      .in("registro_hash", hashes);
    const mapaJa = new Map<string, any>(((jaOk ?? []) as any[]).map((i) => [i.registro_hash, i]));

    const resultados: ResultadoItem[] = [];

    for (const r of data.registros) {
      const nome = r.razaoSocial?.valor ?? r.nomeFantasia?.valor ?? null;
      const base: ResultadoItem = {
        xmlId: r.xmlId,
        status: "ok",
        acao: r.acaoSugerida,
        clienteId: null,
        leadId: null,
        mensagem: null,
        empresa: nome,
        cnpj: r.cnpj,
      };

      try {
        const repetido = mapaJa.get(r.registroHash);
        if (repetido && !data.sobrescrever) {
          resultados.push({
            ...base,
            status: "ignorado",
            acao: "ignorar",
            clienteId: repetido.cliente_id ?? null,
            leadId: repetido.lead_id ?? null,
            mensagem: "Registro já importado anteriormente.",
          });
          await sb.from("pxsales_importacao_itens").upsert(
            {
              importacao_id: data.importacao_id,
              empresa_id: empresaId,
              xml_id: r.xmlId,
              xml_ids: r.xmlIds,
              registro_hash: r.registroHash,
              cnpj: r.cnpj,
              cnpjs: r.cnpjsAdicionais,
              empresa_nome: nome,
              acao: "ignorar",
              status: "ignorado",
              cliente_id: repetido.cliente_id ?? null,
              lead_id: repetido.lead_id ?? null,
              mensagem: "Registro já importado anteriormente.",
              campos: {},
            },
            { onConflict: "importacao_id,xml_id" },
          );
          continue;
        }

        if (r.acaoSugerida === "revisao" || (!r.cnpj && !nome)) {
          resultados.push({ ...base, status: "revisao", acao: "revisao", mensagem: "Dados insuficientes para cadastrar." });
        } else if (r.cnpj && isValidCnpj(r.cnpj)) {
          const dados = dadosCliente(r);
          const { data: existente } = await sb
            .from("px_registry_clientes")
            .select("*")
            .eq("cnpj", r.cnpj)
            .maybeSingle();

          const apiPayload = {
            importacao_id: data.importacao_id,
            origem: "xml_visitas",
            cnpjs_adicionais: r.cnpjsAdicionais,
            cpf: r.cpf,
            inscricao_estadual: r.inscricaoEstadual,
            segmento: r.segmento,
            tipo_carga: r.tipoCarga,
            rotas: r.rotas,
            frequencia: r.frequencia,
            volume_mensal: r.volumeMensal,
            concorrente: r.concorrente,
            potencial_mensal: r.potencialMensal,
            temperatura: r.temperatura,
            responsavel: r.responsavel,
            ultima_visita: r.ultimaVisita,
            total_visitas: r.totalVisitas,
            total_mensagens: r.totalMensagens,
            xml_ids: r.xmlIds,
            extras: r.extras,
          };

          let clienteId: string;
          let acao: ResultadoItem["acao"];
          let conflitos: ConflitoCampo[] = [];

          if (existente) {
            conflitos = conflitosCom(existente, r);
            const patch = data.sobrescrever
              ? Object.fromEntries(Object.entries(dados).filter(([, v]) => v != null && v !== ""))
              : preencherLacunas(existente, dados);
            patch["api_payload"] = { ...(existente.api_payload ?? {}), importacao: apiPayload };
            patch["updated_by"] = userId;
            const { error } = await sb.from("px_registry_clientes").update(patch).eq("id", existente.id);
            if (error) throw new Error(error.message);
            clienteId = existente.id;
            acao = "atualizar";
          } else {
            const { data: novo, error } = await sb
              .from("px_registry_clientes")
              .insert({
                cnpj: r.cnpj,
                ...dados,
                categorias: r.categorias.length ? r.categorias : ["cliente"],
                api_payload: { importacao: apiPayload },
                created_by: userId,
                updated_by: userId,
              })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            clienteId = novo.id;
            acao = "criar";
          }

          await gravarContatos(sb, userId, clienteId, r);
          await gravarEnderecos(sb, userId, clienteId, r);
          await sb
            .from("px_registry_vinculos")
            .upsert(
              { cliente_id: clienteId, sistema_key: "pxsales", vinculado_por: userId },
              { onConflict: "cliente_id,sistema_key", ignoreDuplicates: true },
            );
          await registrarVisita(sb, userId, empresaId, { clienteId }, r);
          await auditar(sb, userId, "px_registry_clientes", clienteId, `importacao_${acao}`, {
            importacao_id: data.importacao_id,
            xml_ids: r.xmlIds,
            conflitos,
          });

          resultados.push({ ...base, acao, clienteId, mensagem: conflitos.length ? `${conflitos.length} campo(s) divergente(s) mantidos` : null });
        } else if (data.criarLeadSemCnpj !== false) {
          const { data: leadExistente } = await sb
            .from("pxsales_leads")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("empresa", nome)
            .maybeSingle();

          const payloadLead = {
            empresa: nome ?? "Sem nome",
            nome_fantasia: r.nomeFantasia?.valor ?? null,
            cidade: r.endereco?.cidade ?? null,
            uf: r.endereco?.uf ?? null,
            segmento: r.segmento,
            origem: "importacao_xml",
            contato_nome: r.contatos[0]?.nome ?? null,
            contato_cargo: r.contatos[0]?.cargo ?? null,
            contato_telefone: r.telefones[0] ?? null,
            contato_email: r.emails[0] ?? null,
            potencial_mensal: r.potencialMensal,
            tipo_carga: r.tipoCarga,
            temperatura: r.temperatura ?? "morno",
            observacoes: [r.observacoesComerciais, r.observacoes].filter(Boolean).join("\n\n"),
            empresa_id: empresaId,
            updated_by: userId,
          };

          let leadId: string;
          if (leadExistente?.id) {
            await sb.from("pxsales_leads").update(payloadLead).eq("id", leadExistente.id);
            leadId = leadExistente.id;
          } else {
            const { data: novo, error } = await sb
              .from("pxsales_leads")
              .insert({ ...payloadLead, created_by: userId })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            leadId = novo.id;
          }
          await registrarVisita(sb, userId, empresaId, { leadId }, r);
          resultados.push({ ...base, acao: "lead", leadId, mensagem: "Sem CNPJ — cadastrado como lead comercial." });
        } else {
          resultados.push({ ...base, status: "ignorado", acao: "ignorar", mensagem: "Sem CNPJ." });
        }
      } catch (e: any) {
        resultados.push({ ...base, status: "erro", mensagem: e?.message ?? "Falha ao importar registro." });
      }

      const ultimo = resultados[resultados.length - 1]!;
      await sb.from("pxsales_importacao_itens").upsert(
        {
          importacao_id: data.importacao_id,
          empresa_id: empresaId,
          xml_id: r.xmlId,
          xml_ids: r.xmlIds,
          registro_hash: r.registroHash,
          cnpj: r.cnpj,
          cnpjs: r.cnpjsAdicionais,
          empresa_nome: nome,
          acao: ultimo.acao,
          status: ultimo.status,
          cliente_id: ultimo.clienteId,
          lead_id: ultimo.leadId,
          mensagem: ultimo.mensagem,
          campos: {
            score: r.score,
            telefones: r.telefones,
            emails: r.emails,
            contatos: r.contatos.length,
            visitas: r.totalVisitas,
            mensagens: r.totalMensagens,
          },
          conflitos: [],
          enriquecido: r.situacaoCadastral != null,
        },
        { onConflict: "importacao_id,xml_id" },
      );
    }

    return resultados;
  });

export const finalizarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { importacao_id: string; empresa_id?: string | null; cancelada?: boolean }) => {
    if (!d?.importacao_id) throw new Error("importacao_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.import");

    const { data: itens } = await sb
      .from("pxsales_importacao_itens")
      .select("acao,status")
      .eq("importacao_id", data.importacao_id);
    const lista = (itens ?? []) as any[];

    const resumo = {
      criados: lista.filter((i) => i.acao === "criar" && i.status === "ok").length,
      atualizados: lista.filter((i) => i.acao === "atualizar" && i.status === "ok").length,
      leads: lista.filter((i) => i.acao === "lead" && i.status === "ok").length,
      ignorados: lista.filter((i) => i.status === "ignorado").length,
      revisao: lista.filter((i) => i.status === "revisao").length,
      erros: lista.filter((i) => i.status === "erro").length,
    };

    const { error } = await sb
      .from("pxsales_importacoes")
      .update({ ...resumo, status: data.cancelada ? "cancelada" : "concluida" })
      .eq("id", data.importacao_id);
    if (error) throw new Error(error.message);

    await auditar(sb, userId, "pxsales_importacoes", data.importacao_id, "finalizar", resumo);
    return { importacaoId: data.importacao_id, total: lista.length, ...resumo };
  });

export const listarImportacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { empresa_id?: string | null; limite?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const userId = (context as any).userId as string;
    await assertPermissao(sb, userId, "pxsales.clientes.view");
    const empresas = await escopoEmpresas(sb, userId, data.empresa_id ?? null);
    const { data: rows, error } = await sb
      .from("pxsales_importacoes")
      .select("*")
      .in("empresa_id", empresas.length ? empresas : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limite ?? 20, 100));
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getImportacaoItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { importacao_id: string }) => {
    if (!d?.importacao_id) throw new Error("importacao_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await assertPermissao(sb, (context as any).userId, "pxsales.clientes.view");
    const { data: rows, error } = await sb
      .from("pxsales_importacao_itens")
      .select("*")
      .eq("importacao_id", data.importacao_id)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
