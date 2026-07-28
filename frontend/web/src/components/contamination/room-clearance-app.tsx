"use client";

import { useState } from "react";
import { ClipboardList, History } from "lucide-react";
import { RoomClearanceForm } from "./room-clearance-form";
import { RoomClearanceHistory } from "./room-clearance-history";

type SubTab = "nueva" | "historial";

// Envoltorio del modulo "Liberacion de Sala": agrupa el formulario de
// ingreso rapido (Fase 2/3) y el historial con busqueda (Fase 4) en dos
// sub-pestanas independientes, dentro de la pestana "Liberacion de Sala" de
// ContaminationApp. Guardar una evaluacion nueva refresca automaticamente el
// historial (via bump de key) sin necesidad de recargar la pagina.
export function RoomClearanceApp() {
  const [tab, setTab] = useState<SubTab>("nueva");
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("nueva")}
          type="button"
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "nueva" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="h-4 w-4" /> Nueva evaluación
        </button>
        <button
          onClick={() => setTab("historial")}
          type="button"
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "historial" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" /> Historial
        </button>
      </div>

      {tab === "nueva" ? (
        <RoomClearanceForm
          onSaved={() => {
            setHistoryKey((k) => k + 1);
          }}
        />
      ) : (
        <RoomClearanceHistory key={historyKey} />
      )}
    </div>
  );
}
