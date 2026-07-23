"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  Boxes,
  Download,
  History,
  MapPin,
  PackageCheck,
  PlusCircle,
  RefreshCw,
  Timer,
  Truck,
} from "lucide-react";
import type { WasteInventoryItem, WasteInventoryMovement, WasteStorageLocation } from "@/lib/waste";

type SubTab = "inventario" | "ubicaciones" | "movimientos" | "decaimiento";

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "muted" }) {
  const toneClass =
    tone === "green"
      ? "bg-success/15 text-success"
      : tone === "amber"
      ? "bg-warning/15 text-warning"
      : "bg-muted text-muted-foreground";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

// --- Sub-panel: Inventario Actual -------------------------------------------
function InventoryPanel({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [items, setItems] = useState<WasteInventoryItem[]>([]);
  const [locations, setLocations] = useState<WasteStorageLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/waste-storage/inventory").then((r) => (r.ok ? r.json() : { rows: [] })),
      fetch("/api/waste-storage/locations").then((r) => (r.ok ? r.json() : { rows: [] })),
    ])
      .then(([inv, locs]) => {
        setItems(inv.rows ?? []);
        setLocations(locs.rows ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function moverA(item: WasteInventoryItem, locationId: number) {
    setBusyId(item.id);
    const movement_type = item.status === "pendiente" ? "ingreso" : "traslado";
    await fetch("/api/waste-storage/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waste_label_id: item.id, movement_type, to_location_id: locationId }),
    });
    setBusyId(null);
    load();
    onChanged();
  }

  async function liberar(item: WasteInventoryItem) {
    if (!window.confirm(`¿Confirma la liberación del residuo ${item.label_number}?`)) return;
    setBusyId(item.id);
    await fetch("/api/waste-storage/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waste_label_id: item.id, movement_type: "liberacion" }),
    });
    setBusyId(null);
    load();
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="text-sm font-medium">
          Inventario en Almacenamiento Temporal <span className="text-muted-foreground">({items.length})</span>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/waste-storage/export?dataset=inventory&format=csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href="/api/waste-storage/export?dataset=inventory&format=xlsx"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">N° Rótulo</th>
              <th className="px-3 py-2">Radionúclido</th>
              <th className="px-3 py-2">Sala / Servicio</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Días</th>
              <th className="px-3 py-2">Semividas</th>
              <th className="px-3 py-2">Actividad actual</th>
              <th className="px-3 py-2">Liberable</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{it.label_number}</td>
                <td className="px-3 py-2">{it.radionuclide_code}</td>
                <td className="px-3 py-2">
                  {it.sala} / {it.service}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                    value={it.storage_location_id ?? ""}
                    disabled={busyId === it.id}
                    onChange={(e) => e.target.value && moverA(it, Number(e.target.value))}
                  >
                    <option value="">{it.location_name ?? "Sin asignar"}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">{it.elapsed_days}</td>
                <td className="px-3 py-2">{it.half_lives_elapsed}</td>
                <td className="px-3 py-2">
                  {it.actividad_actual !== null ? Number(it.actividad_actual).toFixed(3) : "—"} {it.unidad_actividad}
                </td>
                <td className="px-3 py-2">
                  {it.release_eligible ? (
                    <Badge tone="green">Liberable</Badge>
                  ) : (
                    <Badge tone="amber">{it.days_until_release_eligible} día(s)</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => liberar(it)}
                    disabled={busyId === it.id}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Liberar
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay residuos actualmente en almacenamiento.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Sub-panel: Ubicaciones de Almacenamiento -------------------------------
function LocationsPanel({ version }: { version: number }) {
  const [locations, setLocations] = useState<WasteStorageLocation[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/waste-storage/locations")
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => setLocations(d.rows ?? []));
  }

  useEffect(() => {
    load();
  }, [version]);

  async function crear() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/waste-storage/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null, capacity: capacity ? Number(capacity) : null }),
    });
    setName("");
    setDescription("");
    setCapacity("");
    setSaving(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Nueva ubicación</div>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej: Bodega - Contenedor 3)"
            className="min-w-[220px] flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            className="min-w-[220px] flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Capacidad"
            type="number"
            className="w-28 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            onClick={crear}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-sm font-medium">
            Ubicaciones de Almacenamiento <span className="text-muted-foreground">({locations.length})</span>
          </div>
          <a
            href="/api/waste-storage/export?dataset=locations&format=csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Capacidad</th>
                <th className="px-3 py-2">En uso</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    {loc.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{loc.description ?? "—"}</td>
                  <td className="px-3 py-2">{loc.capacity ?? "—"}</td>
                  <td className="px-3 py-2">{loc.current_count ?? 0}</td>
                  <td className="px-3 py-2">
                    {loc.active ? <Badge tone="green">Activa</Badge> : <Badge tone="muted">Inactiva</Badge>}
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No hay ubicaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Sub-panel: Historial de Movimientos ------------------------------------
function MovementsPanel({ version }: { version: number }) {
  const [rows, setRows] = useState<WasteInventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/waste-storage/movements?pageSize=200")
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, [version]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="text-sm font-medium">
          Historial de Movimientos <span className="text-muted-foreground">({rows.length})</span>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/waste-storage/export?dataset=movements&format=csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href="/api/waste-storage/export?dataset=movements&format=xlsx"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">N° Rótulo</th>
              <th className="px-3 py-2">Movimiento</th>
              <th className="px-3 py-2">Desde</th>
              <th className="px-3 py-2">Hacia</th>
              <th className="px-3 py-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2">{new Date(m.moved_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-medium">{m.label_number}</td>
                <td className="px-3 py-2 capitalize">{m.movement_type}</td>
                <td className="px-3 py-2">{m.from_location ?? "—"}</td>
                <td className="px-3 py-2">{m.to_location ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.observaciones ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Todavía no se han registrado movimientos.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Sub-panel: Panel de Decaimiento -----------------------------------------
type DashboardStats = {
  totales: {
    totalEnAlmacenamiento: number;
    liberablesAhora: number;
    tiempoPromedioAlmacenamientoDias: number;
    proximos30Dias: number;
  };
  porUbicacion: { location: string; count: number }[];
  proximosALiberar: { id: number; label_number: string; dias_restantes: number }[];
  movimientosPorMes: { ym: string; movement_type: string; count: number }[];
};

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DecayPanel({ version }: { version: number }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/waste-storage/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d));
  }, [version]);

  if (!stats) {
    return <div className="text-sm text-muted-foreground">Cargando panel de decaimiento...</div>;
  }

  const t = stats.totales;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="En almacenamiento" value={t.totalEnAlmacenamiento} icon={Archive} />
        <StatCard label="Liberables ahora" value={t.liberablesAhora} icon={PackageCheck} />
        <StatCard label="Próximos 30 días" value={t.proximos30Dias} icon={Timer} />
        <StatCard label="Prom. almacenamiento (días)" value={t.tiempoPromedioAlmacenamientoDias} icon={History} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Distribución por ubicación</h3>
          <ul className="space-y-1.5 text-sm">
            {stats.porUbicacion.map((u) => (
              <li key={u.location} className="flex items-center justify-between border-b border-border/50 pb-1">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {u.location}
                </span>
                <span className="font-medium tabular-nums">{u.count}</span>
              </li>
            ))}
            {stats.porUbicacion.length === 0 && <li className="text-muted-foreground">Sin datos.</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            Próximos a cumplir criterio de liberación
          </h3>
          <ul className="space-y-1.5 text-sm">
            {stats.proximosALiberar.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-border/50 pb-1">
                <span>{p.label_number}</span>
                <Badge tone="amber">{p.dias_restantes} día(s)</Badge>
              </li>
            ))}
            {stats.proximosALiberar.length === 0 && (
              <li className="text-muted-foreground">No hay residuos próximos a liberar en los siguientes 30 días.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Componente principal: Inventario y Almacenamiento Temporal ------------
export function WasteInventoryApp({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [subTab, setSubTab] = useState<SubTab>("inventario");

  const tabs: { key: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "inventario", label: "Inventario Actual", icon: Boxes },
    { key: "ubicaciones", label: "Ubicaciones", icon: MapPin },
    { key: "movimientos", label: "Movimientos", icon: Truck },
    { key: "decaimiento", label: "Panel de Decaimiento", icon: Timer },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Control físico del inventario de residuos radiactivos en almacenamiento temporal: ubicación, movimientos y
        avance del decaimiento hasta cumplir el criterio de liberación. Reutiliza automáticamente los rótulos ya
        generados en Gestión de Residuos Radiactivos, sin solicitar información adicional.
      </p>
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 ${
              subTab === key ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {subTab === "inventario" && <InventoryPanel version={version} onChanged={onChanged} />}
      {subTab === "ubicaciones" && <LocationsPanel version={version} />}
      {subTab === "movimientos" && <MovementsPanel version={version} />}
      {subTab === "decaimiento" && <DecayPanel version={version} />}
    </div>
  );
}
