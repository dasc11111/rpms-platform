"use client";

import { useState } from "react";
import { LayoutDashboard, Search, Table2 } from "lucide-react";
import { I131SearchPanel, EMPTY_FILTERS, type I131Filters } from "./i131-search-panel";
import { I131Dashboard } from "./i131-dashboard";
import { I131RecordsTable } from "./i131-records-table";
import { I131FormModal } from "./i131-form-modal";
import type { I131Record } from "@/lib/i131";

type Tab = "dashboard" | "registros";

export function I131App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState<I131Filters>(EMPTY_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<I131Record | null>(null);

  function bump() {
    setVersion((v) => v + 1);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(record: I131Record) {
    setEditing(record);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Administración de I-131</h1>
          <p className="text-xs text-muted-foreground">
            Registro, búsqueda y estadísticas de administraciones de Yodo-131 en Medicina Nuclear.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen((s) => !s)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
              searchOpen ? "border-accent bg-accent-subtle" : "border-border hover:bg-muted"
            }`}
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => setTab("dashboard")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "dashboard" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </button>
        <button
          onClick={() => setTab("registros")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "registros" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <Table2 className="h-4 w-4" /> Registros
        </button>
      </div>

      <I131SearchPanel
        open={searchOpen}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {tab === "dashboard" ? (
        <I131Dashboard filters={filters} version={version} />
      ) : (
        <I131RecordsTable filters={filters} version={version} onNew={openNew} onEdit={openEdit} onChanged={bump} />
      )}

      <I131FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        record={editing}
        onSaved={bump}
      />
    </div>
  );
}
