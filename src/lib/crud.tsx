import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export type FieldType = "text" | "textarea" | "number" | "date" | "select";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  step?: string;
  placeholder?: string;
  colSpan?: 1 | 2;
}

export interface ColumnDef {
  key: string;
  label: string;
  format?: (v: any, row: any) => ReactNode;
  className?: string;
}

interface CrudTableProps {
  table: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  title?: string;
  orderBy?: string;
  orderAsc?: boolean;
  defaults?: Record<string, any>;
  /** Inject created_by = auth.uid() on insert */
  trackUser?: boolean;
  emptyMessage?: string;
  onDataChange?: (rows: any[]) => void;
  renderExtra?: (rows: any[]) => ReactNode;
}

export function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR");
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

export function CrudTable({
  table,
  fields,
  columns,
  title,
  orderBy = "created_at",
  orderAsc = false,
  defaults = {},
  trackUser = true,
  emptyMessage = "Nenhum registro cadastrado.",
  onDataChange,
  renderExtra,
}: CrudTableProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .order(orderBy, { ascending: orderAsc });
    if (error) toast.error(`Erro ao carregar: ${error.message}`);
    const r = (data as any[]) ?? [];
    setRows(r);
    onDataChange?.(r);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  function openCreate() {
    const initial: Record<string, any> = { ...defaults };
    fields.forEach((f) => {
      if (!(f.name in initial)) initial[f.name] = f.type === "number" ? 0 : "";
    });
    setForm(initial);
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: any) {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      initial[f.name] = row[f.name] ?? (f.type === "number" ? 0 : "");
    });
    setForm(initial);
    setEditing(row);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = { ...form };
    fields.forEach((f) => {
      if (f.type === "number") payload[f.name] = payload[f.name] === "" || payload[f.name] == null ? null : Number(payload[f.name]);
      if ((f.type === "text" || f.type === "textarea" || f.type === "select" || f.type === "date") && payload[f.name] === "") {
        payload[f.name] = null;
      }
    });

    if (editing) {
      const { error } = await supabase.from(table as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Registro atualizado");
    } else {
      if (trackUser) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) payload.created_by = u.user.id;
      }
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Registro criado");
    }
    setOpen(false);
    load();
  }

  async function remove(row: any) {
    if (!confirm("Excluir este registro? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {title ? <h3 className="text-sm font-medium">{title}</h3> : <div />}
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand text-brand-foreground text-xs font-medium hover:opacity-90"
        >
          <Plus className="size-3.5" /> Novo
        </button>
      </div>

      <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`text-left font-medium px-4 py-3 text-xs ${c.className ?? ""}`}>
                    {c.label}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3 text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-surface-2/40">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                        {c.format ? c.format(row[c.key], row) : (row[c.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-md hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => remove(row)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {renderExtra?.(rows)}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-surface ring-1 ring-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-sm font-medium">{editing ? "Editar registro" : "Novo registro"}</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={save} className="p-6 grid grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.name} className={f.colSpan === 2 ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      className="input min-h-[80px]"
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={f.required}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === "select" ? (
                    <select
                      className="input"
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={f.required}
                    >
                      <option value="">— selecione —</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={f.type}
                      step={f.step}
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={f.required}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
              <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-brand text-brand-foreground text-xs font-medium hover:opacity-90"
                >
                  {editing ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; codigo: string | null }[]>([]);
  useEffect(() => {
    supabase
      .from("empresas")
      .select("id, nome, codigo")
      .order("nome")
      .then(({ data }) => setEmpresas((data as any[]) ?? []));
  }, []);
  return empresas;
}
