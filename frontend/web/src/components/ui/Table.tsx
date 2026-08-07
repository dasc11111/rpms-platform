"use client";
import * as React from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown, Search, Columns3, Download, Copy, Rows3, Rows2 } from "lucide-react";
import { Button } from "./Button";

export interface SmartTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null;
  width?: string;
  frozen?: boolean;
}

export interface SmartTableProps<T> {
  columns: SmartTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  storageKey?: string;
  exportFileName?: string;
  emptyMessage?: string;
}

export function SmartTable<T>({ columns, data, rowKey, storageKey, exportFileName = "export", emptyMessage = "Sin registros" }: SmartTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [compact, setCompact] = React.useState(false);
  const [hiddenCols, setHiddenCols] = React.useState<string[]>([]);
  const [showColMenu, setShowColMenu] = React.useState(false);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem("rpms-table-" + storageKey);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (Array.isArray(cfg.hiddenCols)) setHiddenCols(cfg.hiddenCols);
        if (typeof cfg.compact === "boolean") setCompact(cfg.compact);
      }
    } catch {}
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem("rpms-table-" + storageKey, JSON.stringify({ hiddenCols, compact }));
  }, [storageKey, hiddenCols, compact]);

  const visibleColumns = columns.filter((c) => !hiddenCols.includes(c.key));

  const filtered = React.useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((c) => {
        const val = c.accessor(row);
        return typeof val === "string" || typeof val === "number" ? String(val).toLowerCase().includes(q) : false;
      })
    );
  }, [data, search, columns]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleColumn(key: string) {
    setHiddenCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function copyTable() {
    const header = visibleColumns.map((c) => c.header).join("\t");
    const rows = sorted.map((row) => visibleColumns.map((c) => String(c.accessor(row) ?? "")).join("\t"));
    navigator.clipboard.writeText([header, ...rows].join("\n")).catch(() => {});
  }

  async function exportCsv() {
    const XLSX = await import("xlsx");
    const header = visibleColumns.map((c) => c.header);
    const rows = sorted.map((row) => visibleColumns.map((c) => String(c.accessor(row) ?? "")));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, exportFileName + ".xlsx");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button size="sm" variant="outline" icon={compact ? <Rows2 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />} onClick={() => setCompact((c) => !c)}>
          {compact ? "Vista extendida" : "Vista compacta"}
        </Button>
        <div className="relative">
          <Button size="sm" variant="outline" icon={<Columns3 className="h-3.5 w-3.5" />} onClick={() => setShowColMenu((s) => !s)}>
            Columnas
          </Button>
          {showColMenu ? (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-surface-elevated p-2 shadow-lg">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-xs">
                  <input type="checkbox" checked={!hiddenCols.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.header}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <Button size="sm" variant="outline" icon={<Copy className="h-3.5 w-3.5" />} onClick={copyTable}>
          Copiar
        </Button>
        <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv}>
          Exportar
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left">
          <thead className="bg-muted">
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortValue && toggleSort(c.key)}
                  style={{ width: c.width }}
                  className={clsx(
                    "whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    c.sortValue && "cursor-pointer select-none",
                    c.frozen && "sticky left-0 z-10 bg-muted"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sortKey === c.key ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" /> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border hover:bg-muted/40">
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={clsx("px-3 text-sm", compact ? "py-1.5" : "py-2.5", c.frozen && "sticky left-0 z-10 bg-surface")}>
                      {c.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
