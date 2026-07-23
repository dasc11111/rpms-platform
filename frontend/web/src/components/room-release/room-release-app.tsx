"use client";

import { useState } from "react";
import { Boxes, LayoutDashboard, FileText, Recycle } from "lucide-react";
import { RoomReleaseRecordsTable } from "./room-release-records-table";
import { RoomReleaseFormModal } from "./room-release-form-modal";
import { WasteLabelConfirmModal } from "./waste-label-confirm-modal";
import { WasteLabelsTable } from "./waste-labels-table";
import { WasteDashboard } from "./waste-dashboard";
import { WasteInventoryApp } from "./waste-inventory-app";
import type { RoomReleaseRecord } from "@/lib/waste";

type Tab = "acta" | "residuos" | "inventario" | "dashboard";

export function RoomReleaseApp() {
  const [tab, setTab] = useState<Tab>("acta");
  const [version, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmRecord, setConfirmRecord] = useState<RoomReleaseRecord | null>(null);

  function bump() {
    setVersion((v) => v + 1);
  }

  function handleActaSaved(record: RoomReleaseRecord) {
    setFormOpen(false);
    bump();
    // Automatizacion: al terminar el registro de Liberacion de Sala, el
    // sistema pregunta automaticamente si se desea generar el rotulo,
    // reutilizando toda la informacion ya ingresada (sin pedirla de nuevo).
    setConfirmRecord(record);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Liberación de Sala Hospitalizado</h1>
        <p className="text-xs text-muted-foreground">
          Acta de Liberación de Sala, Gestión de Residuos Radiactivos e Inventario / Almacenamiento Temporal,
          totalmente integrados: la información del acta se reutiliza automáticamente para generar el rótulo del
          residuo y su seguimiento en almacenamiento.
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => setTab("acta")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "acta" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <FileText className="h-4 w-4" /> Acta de Liberación de Sala
        </button>
        <button
          onClick={() => setTab("residuos")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "residuos" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <Recycle className="h-4 w-4" /> Gestión de Residuos Radiactivos
        </button>
        <button
          onClick={() => setTab("inventario")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "inventario" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <Boxes className="h-4 w-4" /> Inventario y Almacenamiento
        </button>
        <button
          onClick={() => setTab("dashboard")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
            tab === "dashboard" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </button>
      </div>

      {tab === "acta" && (
        <RoomReleaseRecordsTable version={version} onNew={() => setFormOpen(true)} onGenerateLabel={setConfirmRecord} />
      )}

      {tab === "residuos" && <WasteLabelsTable version={version} onChanged={bump} />}

      {tab === "inventario" && <WasteInventoryApp version={version} onChanged={bump} />}

      {tab === "dashboard" && <WasteDashboard version={version} />}

      <RoomReleaseFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={handleActaSaved} />

      <WasteLabelConfirmModal
        record={confirmRecord}
        onClose={() => setConfirmRecord(null)}
        onGenerated={() => {
          setConfirmRecord(null);
          bump();
        }}
      />
    </div>
  );
}
