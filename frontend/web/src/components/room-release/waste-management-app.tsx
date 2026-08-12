"use client";

import { useState } from "react";
import { Boxes, LayoutDashboard, Recycle } from "lucide-react";
import { WasteLabelsTable } from "./waste-labels-table";
import { WasteDashboard } from "./waste-dashboard";
import { WasteInventoryApp } from "./waste-inventory-app";

type Tab = "residuos" | "inventario" | "dashboard";

export function WasteManagementApp() {
const [tab, setTab] = useState<Tab>("residuos");
const [version, setVersion] = useState(0);

function bump() {
setVersion((v) => v + 1);
}

return (
  <div className="mx-auto max-w-[1400px] p-6">
<div className="mb-4">
<h1 className="text-lg font-semibold">Gestion de Residuos Radiactivos</h1>
  <p className="text-xs text-muted-foreground">
Rotulos, criterio universal de dispensa, seguimiento de decaimiento, inventario y almacenamiento
  temporal, y estadisticas de los residuos radiactivos generados en el servicio: tanto los residuos
  generados de forma independiente (Capacho I-131, Generador Mo-99/Tc-99m, Cortopunzante Tc-99m) como
  los provenientes de un Acta de Liberacion de Sala.

</p>
  </div>

<div className="mb-4 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm">
<button
  onClick={() => setTab("residuos")}
className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
tab === "residuos" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
  }`}
>
<Recycle className="h-4 w-4" /> Rotulos de Residuos
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

{tab === "residuos" && <WasteLabelsTable version={version} onChanged={bump} />}
{tab === "inventario" && <WasteInventoryApp version={version} onChanged={bump} />}
{tab === "dashboard" && <WasteDashboard version={version} />}
</div>
  );
}
