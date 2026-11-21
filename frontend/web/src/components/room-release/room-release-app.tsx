"use client";

import { useState } from "react";
import { Recycle } from "lucide-react";
import { RoomReleaseRecordsTable } from "./room-release-records-table";
import { RoomReleaseFormModal } from "./room-release-form-modal";
import { WasteLabelConfirmModal } from "./waste-label-confirm-modal";
import type { RoomReleaseRecord } from "@/lib/waste";

export function RoomReleaseApp() {
  const [version, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<RoomReleaseRecord | null>(null);
  const [confirmRecord, setConfirmRecord] = useState<RoomReleaseRecord | null>(null);

function bump() {
  setVersion((v) => v + 1);
}

function handleNew() {
  setEditRecord(null);
  setFormOpen(true);
}

function handleEdit(record: RoomReleaseRecord) {
  setEditRecord(record);
  setFormOpen(true);
}

function handleCloseForm() {
  setFormOpen(false);
  setEditRecord(null);
}

function handleActaSaved(record: RoomReleaseRecord) {
  setFormOpen(false);
  setEditRecord(null);
  bump();
  // Automatizacion: al terminar el registro de Liberacion de Sala, el
  // sistema pregunta automaticamente si se desea generar el rotulo,
  // reutilizando toda la informacion ya ingresada (sin pedirla de nuevo).
  setConfirmRecord(record);
}

return (
  <div className="mx-auto max-w-[1400px] p-6">
  <div className="mb-4 flex items-start justify-between gap-4">
  <div>
  <h1 className="text-lg font-semibold">Liberacion de Sala Hospitalizado</h1>
  <p className="text-xs text-muted-foreground">
  Acta de Liberacion de Sala. Al guardar el acta, el sistema ofrece generar automaticamente el rotulo
  del residuo radiactivo asociado, reutilizando toda la informacion ya ingresada.
  </p>
  </div>
  <a
    href="/waste-management"
    className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
    >
  <Recycle className="h-3.5 w-3.5" /> Ir a Gestion de Residuos
  </a>
  </div>

    <RoomReleaseRecordsTable
      version={version}
      onNew={handleNew}
      onGenerateLabel={setConfirmRecord}
      onEdit={handleEdit}
      />

    <RoomReleaseFormModal open={formOpen} record={editRecord} onClose={handleCloseForm} onSaved={handleActaSaved} />

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
