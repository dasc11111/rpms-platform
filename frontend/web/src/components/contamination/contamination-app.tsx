"use client";

import { useState } from "react";
import { LayoutDashboard, Search, Settings2, Table2 } from "lucide-react";
import { ContaminationSearchPanel, EMPTY_FILTERS, type ContaminationFilters } from "./contamination-search-panel";
import { ContaminationDashboard } from "./contamination-dashboard";
import { ContaminationRecordsTable } from "./contamination-records-table";
import { ContaminationFormModal } from "./contamination-form-modal";
import { ContaminationLimitsPanel } from "./contamination-limits-panel";
import type { ContaminationRecord } from "@/lib/contamination";

type Tab = "dashboard" | "registros";

export function ContaminationApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState<ContaminationFilters>(EMPTY_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaminationRecord | null>(null);

  function bump() {
    setVersion((v) => v + 1);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(record: ContaminationRecord) {
    setEditing(record);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Registro de Contaminación</h1>
          <p className="text-xs text-muted-foreground">
            Monitoreo de contaminación superficial en Medicina Nuclear: registro, cálculo automático, clasificación
            por semáforo y estadísticas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLimitsOpen((s) => !s)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
              limitsOpen ? "border-accent bg-accent-subtle" : "border-border hover:bg-muted"
            }`}
          >
            <Settings2 className="h-4 w-4" /> Límites
          </button>
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

      <ContaminationLimitsPanel open={limitsOpen} />

      <ContaminationSearchPanel
        open={searchOpen}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {tab === "dashboard" ? (
        <ContaminationDashboard filters={filters} version={version} />
      ) : (
        <ContaminationRecordsTable filters={filters} version={version} onNew={openNew} onEdit={openEdit} onChanged={bump} />
      )}

      <ContaminationFormModal open={modalOpen} onClose={() => setModalOpen(false)} record={editing} onSaved={bump} />
    </div>
  );
}
