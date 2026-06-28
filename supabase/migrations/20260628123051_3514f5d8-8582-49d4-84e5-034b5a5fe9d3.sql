INSERT INTO public.tms_clientes (registry_id, nome, cnpj, contato, telefone, email, endereco, cidade, uf, observacoes, ativo)
SELECT
  r.id,
  COALESCE(NULLIF(r.nome_fantasia, ''), NULLIF(r.razao_social, ''), r.cnpj),
  r.cnpj,
  r.contato_nome,
  r.telefone,
  r.email,
  NULLIF(concat_ws(', ', r.logradouro, r.numero, r.complemento, r.bairro), ''),
  r.cidade,
  r.uf,
  r.observacoes,
  COALESCE(r.ativo, true)
FROM public.px_registry_clientes r
LEFT JOIN public.tms_clientes t ON t.registry_id = r.id
WHERE t.id IS NULL;