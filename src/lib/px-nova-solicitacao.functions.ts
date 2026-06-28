import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const loadClienteCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) => {
    if (!d?.cliente_id) throw new Error("cliente_id obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [cli, ends, conts, tms] = await Promise.all([
      sb.from("px_registry_clientes").select("*").eq("id", data.cliente_id).maybeSingle(),
      sb.from("px_registry_enderecos").select("*").eq("cliente_id", data.cliente_id)
        .order("is_padrao_remetente", { ascending: false })
        .order("is_padrao_destinatario", { ascending: false })
        .order("created_at", { ascending: true }),
      sb.from("px_registry_contatos").select("*").eq("cliente_id", data.cliente_id)
        .order("is_principal", { ascending: false }),
      sb.from("tms_clientes").select("id").eq("registry_id", data.cliente_id).maybeSingle(),
    ]);
    let enderecos = ends.data ?? [];
    const c = cli.data;
    // Fallback: sintetiza endereço virtual a partir dos campos legados do cadastro
    // quando o cliente ainda não possui rows em px_registry_enderecos.
    if (enderecos.length === 0 && c && (c.logradouro || c.cidade || c.cep)) {
      enderecos = [{
        id: `legacy:${c.id}`,
        cliente_id: c.id,
        tipo: "matriz",
        apelido: "Endereço principal (cadastro)",
        cep: c.cep ?? null,
        logradouro: c.logradouro ?? null,
        numero: c.numero ?? null,
        complemento: c.complemento ?? null,
        bairro: c.bairro ?? null,
        cidade: c.cidade ?? null,
        uf: c.uf ?? null,
        ponto_referencia: null,
        observacoes: c.observacoes ?? null,
        janela_recebimento: null,
        restricoes: [],
        is_padrao_remetente: true,
        is_padrao_destinatario: true,
        ativo: true,
      } as any];
    }
    return {
      cliente: c ?? null,
      enderecos,
      contatos: conts.data ?? [],
      tms_cliente_id: tms.data?.id ?? null,
    };
  });

