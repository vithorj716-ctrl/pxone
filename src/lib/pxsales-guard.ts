// PXSales — guarda de acesso aplicada no SERVIDOR, dentro de cada server function.
// Reutiliza a infra existente (px_usuario_perfis / px_perfil_permissoes / px_usuarios_meta / empresas)
// através das funções px_has_permission, px_user_empresas e pxsales_can.

import { PXSALES_SISTEMA_KEY, type PxSalesPermission } from "@/pxsales/pxsales.permissions";

type Sb = any;

/** Empresas do grupo que o usuário pode enxergar (diretoria enxerga todas). */
export async function empresasPermitidas(sb: Sb, userId: string): Promise<string[]> {
  const { data, error } = await sb.rpc("px_user_empresas", { _user_id: userId });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  return rows
    .map((r) => (typeof r === "string" ? r : (r?.px_user_empresas ?? r?.id)))
    .filter(Boolean) as string[];
}

/** Bloqueia a chamada quando o perfil do usuário não tem a permissão pedida. */
export async function assertPermissao(sb: Sb, userId: string, acao: PxSalesPermission) {
  const { data, error } = await sb.rpc("px_has_permission", {
    _user_id: userId,
    _sistema: PXSALES_SISTEMA_KEY,
    _acao: acao,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seu perfil não tem permissão para esta ação no PXSales.");
  return true;
}

export async function assertEmpresaPermitida(sb: Sb, userId: string, empresaId: string | null | undefined) {
  if (!empresaId) throw new Error("Empresa não informada.");
  const { data, error } = await sb.rpc("px_can_access_empresa", { _user_id: userId, _empresa_id: empresaId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você não tem acesso a esta empresa do grupo.");
  return empresaId;
}

/**
 * Define a empresa de um registro novo. Usa a empresa enviada pela tela (validando o acesso)
 * ou, quando o usuário só tem uma empresa, assume essa.
 */
export async function resolveEmpresaId(sb: Sb, userId: string, empresaId?: string | null): Promise<string> {
  if (empresaId) return await assertEmpresaPermitida(sb, userId, empresaId);
  const ids = await empresasPermitidas(sb, userId);
  if (ids.length === 1) return ids[0]!;
  if (!ids.length) throw new Error("Seu usuário não está vinculado a nenhuma empresa do grupo.");
  throw new Error("Selecione a empresa ativa no topo da tela antes de salvar.");
}

/** Escopo de leitura: filtra pela empresa ativa (se enviada e permitida) ou por todas as permitidas. */
export async function escopoEmpresas(
  sb: Sb,
  userId: string,
  empresaId?: string | null,
): Promise<string[]> {
  const ids = await empresasPermitidas(sb, userId);
  if (empresaId) {
    if (!ids.includes(empresaId)) throw new Error("Você não tem acesso a esta empresa do grupo.");
    return [empresaId];
  }
  return ids;
}

/** Paginação padrão das listagens. */
export function faixa(page?: number, pageSize?: number) {
  const size = Math.min(Math.max(Number(pageSize) || 100, 1), 500);
  const p = Math.max(Number(page) || 1, 1);
  return { from: (p - 1) * size, to: p * size - 1, size, page: p };
}

/** Registro de auditoria das mutações comerciais. */
export async function auditar(
  sb: Sb,
  userId: string,
  entity_type: string,
  entity_id: string,
  action: string,
  diff?: Record<string, unknown>,
) {
  try {
    await sb.from("px_audit_log").insert({
      entity_type,
      entity_id,
      action,
      diff: diff ?? null,
      user_id: userId,
    });
  } catch {
    /* auditoria nunca deve derrubar a operação */
  }
}
