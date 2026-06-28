import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIAS_CLIENTE } from "@/lib/px-registry.functions";

export type ClienteFormState = {
  id?: string | null;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  natureza_juridica: string;
  cnae_principal: string;
  cnae_descricao: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  contato_nome: string;
  contato_cargo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  observacoes: string;
  condicao_pagamento: string;
  limite_credito: string;
  categorias: string[];
};

export function emptyCliente(): ClienteFormState {
  return {
    cnpj: "", razao_social: "", nome_fantasia: "", situacao_cadastral: "",
    data_abertura: "", natureza_juridica: "", cnae_principal: "", cnae_descricao: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    contato_nome: "", contato_cargo: "", telefone: "", whatsapp: "", email: "",
    observacoes: "", condicao_pagamento: "", limite_credito: "",
    categorias: ["cliente"],
  };
}

export function fromCnpjData(d: any, current: ClienteFormState): ClienteFormState {
  return {
    ...current,
    cnpj: d.cnpj ?? current.cnpj,
    razao_social: d.razao_social ?? "",
    nome_fantasia: d.nome_fantasia ?? "",
    situacao_cadastral: d.situacao_cadastral ?? "",
    data_abertura: d.data_abertura ?? "",
    natureza_juridica: d.natureza_juridica ?? "",
    cnae_principal: d.cnae_principal ?? "",
    cnae_descricao: d.cnae_descricao ?? "",
    cep: d.cep ?? "",
    logradouro: d.logradouro ?? "",
    numero: d.numero ?? "",
    complemento: d.complemento ?? "",
    bairro: d.bairro ?? "",
    cidade: d.cidade ?? "",
    uf: d.uf ?? "",
    telefone: current.telefone || d.telefone || "",
    email: current.email || d.email || "",
  };
}

export function fromExisting(row: any): ClienteFormState {
  const base = emptyCliente();
  return {
    ...base,
    id: row.id,
    cnpj: row.cnpj ?? "",
    razao_social: row.razao_social ?? "",
    nome_fantasia: row.nome_fantasia ?? "",
    situacao_cadastral: row.situacao_cadastral ?? "",
    data_abertura: row.data_abertura ?? "",
    natureza_juridica: row.natureza_juridica ?? "",
    cnae_principal: row.cnae_principal ?? "",
    cnae_descricao: row.cnae_descricao ?? "",
    cep: row.cep ?? "",
    logradouro: row.logradouro ?? "",
    numero: row.numero ?? "",
    complemento: row.complemento ?? "",
    bairro: row.bairro ?? "",
    cidade: row.cidade ?? "",
    uf: row.uf ?? "",
    contato_nome: row.contato_nome ?? "",
    contato_cargo: row.contato_cargo ?? "",
    telefone: row.telefone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    observacoes: row.observacoes ?? "",
    condicao_pagamento: row.condicao_pagamento ?? "",
    limite_credito: row.limite_credito != null ? String(row.limite_credito) : "",
    categorias: Array.isArray(row.categorias) && row.categorias.length ? row.categorias : ["cliente"],
  };
}

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 | 3 | 4 }) {
  const cls = span === 4 ? "sm:col-span-4" : span === 3 ? "sm:col-span-3" : span === 2 ? "sm:col-span-2" : "";
  return (
    <div className={`space-y-1 ${cls}`}>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ClienteForm({
  value,
  onChange,
  readOnly = false,
}: {
  value: ClienteFormState;
  onChange: (next: ClienteFormState) => void;
  readOnly?: boolean;
}) {
  const set = <K extends keyof ClienteFormState>(k: K, v: ClienteFormState[K]) => onChange({ ...value, [k]: v });

  const toggleCat = (cat: string, on: boolean) => {
    const next = on ? Array.from(new Set([...value.categorias, cat])) : value.categorias.filter((c) => c !== cat);
    set("categorias", next);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados cadastrais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <F label="CNPJ"><Input value={value.cnpj} disabled readOnly /></F>
          <F label="Situação"><Input value={value.situacao_cadastral} onChange={(e) => set("situacao_cadastral", e.target.value)} readOnly={readOnly} /></F>
          <F label="Data abertura"><Input type="date" value={value.data_abertura} onChange={(e) => set("data_abertura", e.target.value)} readOnly={readOnly} /></F>
          <F label="Natureza Jurídica"><Input value={value.natureza_juridica} onChange={(e) => set("natureza_juridica", e.target.value)} readOnly={readOnly} /></F>
          <F label="Razão Social" span={2}><Input value={value.razao_social} onChange={(e) => set("razao_social", e.target.value)} readOnly={readOnly} /></F>
          <F label="Nome Fantasia" span={2}><Input value={value.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} readOnly={readOnly} /></F>
          <F label="CNAE"><Input value={value.cnae_principal} onChange={(e) => set("cnae_principal", e.target.value)} readOnly={readOnly} /></F>
          <F label="CNAE — descrição" span={3}><Input value={value.cnae_descricao} onChange={(e) => set("cnae_descricao", e.target.value)} readOnly={readOnly} /></F>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <F label="CEP"><Input value={value.cep} onChange={(e) => set("cep", e.target.value)} readOnly={readOnly} /></F>
          <F label="Logradouro" span={2}><Input value={value.logradouro} onChange={(e) => set("logradouro", e.target.value)} readOnly={readOnly} /></F>
          <F label="Número"><Input value={value.numero} onChange={(e) => set("numero", e.target.value)} readOnly={readOnly} /></F>
          <F label="Complemento" span={2}><Input value={value.complemento} onChange={(e) => set("complemento", e.target.value)} readOnly={readOnly} /></F>
          <F label="Bairro" span={2}><Input value={value.bairro} onChange={(e) => set("bairro", e.target.value)} readOnly={readOnly} /></F>
          <F label="Cidade" span={3}><Input value={value.cidade} onChange={(e) => set("cidade", e.target.value)} readOnly={readOnly} /></F>
          <F label="UF"><Input value={value.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} readOnly={readOnly} /></F>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato comercial</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <F label="Nome do contato" span={2}><Input value={value.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} readOnly={readOnly} /></F>
          <F label="Cargo" span={2}><Input value={value.contato_cargo} onChange={(e) => set("contato_cargo", e.target.value)} readOnly={readOnly} /></F>
          <F label="Telefone"><Input value={value.telefone} onChange={(e) => set("telefone", e.target.value)} readOnly={readOnly} /></F>
          <F label="WhatsApp"><Input value={value.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} readOnly={readOnly} /></F>
          <F label="E-mail" span={2}><Input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} readOnly={readOnly} /></F>
          <F label="Condição de pagamento" span={2}><Input value={value.condicao_pagamento} onChange={(e) => set("condicao_pagamento", e.target.value)} placeholder="Ex.: 28 DDL" readOnly={readOnly} /></F>
          <F label="Limite de crédito (R$)" span={2}>
            <Input type="number" step="0.01" value={value.limite_credito} onChange={(e) => set("limite_credito", e.target.value)} readOnly={readOnly} />
          </F>
          <F label="Observações" span={4}>
            <Textarea value={value.observacoes} onChange={(e) => set("observacoes", e.target.value)} readOnly={readOnly} rows={2} />
          </F>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categorias</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIAS_CLIENTE.map((c) => {
            const checked = value.categorias.includes(c.value);
            return (
              <label key={c.value} className="flex items-center gap-2 text-sm rounded-md border border-border px-2.5 py-2 cursor-pointer hover:bg-white/5">
                <Checkbox checked={checked} disabled={readOnly} onCheckedChange={(v) => toggleCat(c.value, !!v)} />
                {c.label}
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function useClienteForm(initial?: ClienteFormState) {
  return useState<ClienteFormState>(initial ?? emptyCliente());
}
