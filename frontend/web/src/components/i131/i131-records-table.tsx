"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { I131Filters } from "./i131-search-panel";
import { pad2, type I131Record } from "@/lib/i131";

type ColumnKey =
  | "admin_date"
  | "paciente_nombre"
  | "paciente_run"
  | "radiofarmaco"
  | "dosis_administrada"
  | "ficha_clinica"
  | "prevision"
  | "diagnostico"
  | "medico_solicitante"
  | "procedencia"
  | "tipo_examen"
  | "equipo"
  | "motivo"
  | "protocolo"
  | "partida"
  | "pedido_numero";

const ALL_COLUMNS: { key: ColumnKey; label: string; core?: boolean }[] = [
  { key: "admin_date", label: "Fecha", core: true },
  { key: "paciente_nombre", label: "Paciente", core: true },
  { key: "radiofarmaco", label: "Radiofármaco", core: true },
  { key: "dosis_administrada", label: "Dosis (mCi)", core: true },
  { key: "paciente_run", label: "RUN" },
  { key: "ficha_clinica", label: "Ficha" },
  { key: "prevision", label: "Previsión" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "medico_solicitante", label: "Médico Nuclear" },
  { key: "procedencia", label: "Procedencia" },
  { key: "tipo_examen", label: "Tipo examen" },
  { key: "equipo", label: "Equipo" },
  { key: "motivo", label: "Motivo" },
  { key: "protocolo", label: "Protocolo" },
  { key: "partida", label: "Partida" },
  { key: "pedido_numero", label: "N° Pedido" },
];

const DEFAULT_VISIBLE: ColumnKey[] = [
  "admin_date",
  "paciente_nombre",
  "radiofarmaco",
  "dosis_administrada",
  "ficha_clinica",
  "prevision",
  "diagnostico",
  "medico_solicitante",
];

function filtersToQuery(filters: I131Filters, extra: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

export function I131RecordsTable({
  filters,
  version,
  onNew,
  onEdit,
  onChanged,
}: {
  filters: I131Filters;
  version: number;
  onNew: () => void;
  onEdit: (record: I131Record) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<I131Record[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sort, setSort] = useState<string>("admin_date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
  const [showColumns, setShowColumns] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = filtersToQuery(filters, {
      sort,
      dir,
      page: String(page),
      pageSize: String(pageSize),
    });
    fetch(`/api/i131?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, dir, page, pageSize, version]);

  const columns = useMemo(() => ALL_COLUMNS.filter((c) => visible.includes(c.key)), [visible]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(key: string) {
    if (sort === key) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setDir("asc");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este registro de administración de I-131? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/i131/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  function exportUrl(format: string) {
    const qs = filtersToQuery(filters, { format });
    return `/api/i131/export?${qs}`;
  }

  function fmtCell(row: I131Record, key: ColumnKey): string {
    if (key === "admin_date") {
      return `${pad2(row.admin_day)}-${pad2(row.admin_month)}-${row.admin_year}`;
    }
    const v = row[key as keyof I131Record];
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {loading ? "Cargando..." : `${total} registro${total === 1 ? "" : "s"}`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowColumns((s) => !s)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              <Columns3 className="h-3.5 w-3.5" /> Columnas
            </button>
            {showColumns && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-surface p-2 shadow-lg">
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                    <input
                      type="checkbox"
                      disabled={c.core}
                      checked={visible.includes(c.key)}
                      onChange={(e) => {
                        setVisible((v) =>
                          e.target.checked ? [...v, c.key] : v.filter((k) => k !== c.key)
                        );
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <a
            href={exportUrl("csv")}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href={exportUrl("xlsx")}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </a>
          <a
            href={exportUrl("pdf")}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </a>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva administración
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {fmtCell(row, c.key)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onEdit(row)} className="rounded-md p-1.5 hover:bg-muted" title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="rounded-md p-1.5 text-danger hover:bg-danger/10"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                  No hay registros que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Página {page} de {totalPages}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border p-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-border p-1.5 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
