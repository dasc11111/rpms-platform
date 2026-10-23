"use client";

import { useEffect, useState } from "react";

/**
 * MODULO 2 - GAMMACAMARA - FASE A
 * Ficha técnica de la gammacámara (DS 133/1984; IAEA TECDOC-602).
 * Permite registrar y editar datos del equipo que alimentan el resto
 * del módulo: pruebas de QC, baseline, eventos de servicio y evidencia.
 */

type Equipment = {
  id: number;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  num_detectors: number | null;
  crystal_type: string | null;
  crystal_size_inch: number | null;
  fov_dimensions: string | null;
  energy_resolution_percent: number | null;
  intrinsic_resolution_fwhm_mm: number | null;
  collimator_types: string | null;
  software_name: string | null;
  software_version: string | null;
  installation_date: string | null;
  acceptance_date: string | null;
  last_calibration_date: string | null;
  last_service_date: string | null;
  authorization_number: string | null;
  authorization_expiry_date: string | null;
  notes: string | null;
};

const emptyForm: Partial<Equipment> = {
  institution_name: "",
  service_name: "Medicina Nuclear",
  manufacturer: "",
  model: "",
  serial_number: "",
  internal_code: "",
  num_detectors: 2,
  crystal_type: "NaI(Tl)",
  collimator_types: "",
};

export default function GammacamaraEquipmentApp() {
  const [list, setList] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Equipment>>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/quality-control/gammacamara/equipment");
    setList(await res.json());
  }

  useEffect(() => { load(); }, []);

  function select(eq: Equipment | null) {
    if (!eq) { setSelectedId(null); setForm(emptyForm); return; }
    setSelectedId(eq.id);
    setForm(eq);
  }

  function upd<K extends keyof Equipment>(key: K, val: Equipment[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const method = selectedId ? "PUT" : "POST";
      const body = selectedId ? { ...form, id: selectedId } : form;
      const res = await fetch("/api/quality-control/gammacamara/equipment", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(selectedId ? "Ficha actualizada correctamente." : "Equipo registrado correctamente.");
      await load();
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Ficha Técnica — Gammacámara</h1>
        <p className="text-xs text-muted-foreground">
          DS 133/1984 MINSAL · IAEA TECDOC-602. Registro de equipos de medicina nuclear con cámara de centelleo.
        </p>
      </div>

      {/* Equipment list */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium">Equipos registrados</span>
          <button
            className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
            onClick={() => select(null)}
          >
            + Nuevo equipo
          </button>
        </div>
        {list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin equipos registrados. Registre el primer equipo abajo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left">Fabricante / Modelo</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Código interno</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">N° detectors</th>
                <th className="px-4 py-2 text-left hidden lg:table-cell">Autorizacion vto.</th>
                <th className="px-4 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map(eq => {
                const expired = eq.authorization_expiry_date && new Date(eq.authorization_expiry_date) < new Date();
                return (
                  <tr key={eq.id} className={`hover:bg-muted/30 ${selectedId === eq.id ? "bg-muted/20" : ""}`}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{eq.manufacturer} {eq.model}</span>
                      {eq.serial_number && <span className="ml-2 text-xs text-muted-foreground">S/N: {eq.serial_number}</span>}
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell text-muted-foreground text-xs">{eq.internal_code ?? "—"}</td>
                    <td className="px-4 py-2 hidden md:table-cell text-muted-foreground text-xs">{eq.num_detectors ?? "—"} cabezal(es)</td>
                    <td className="px-4 py-2 hidden lg:table-cell text-xs">
                      {eq.authorization_expiry_date ? (
                        <span className={expired ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {eq.authorization_expiry_date.slice(0, 10)}{expired ? " ⚠ VENCIDA" : ""}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        onClick={() => select(eq)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 space-y-4 bg-surface">
        <h2 className="text-sm font-semibold">
          {selectedId ? "Editar equipo" : "Registrar nuevo equipo"}
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Institución</label>
            <input className={inputCls} value={form.institution_name ?? ""} onChange={e => upd("institution_name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Servicio</label>
            <input className={inputCls} value={form.service_name ?? ""} onChange={e => upd("service_name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fabricante *</label>
            <input className={inputCls} required value={form.manufacturer ?? ""} onChange={e => upd("manufacturer", e.target.value)} placeholder="p.ej. Siemens, GE, Philips" />
          </div>
          <div>
            <label className={labelCls}>Modelo *</label>
            <input className={inputCls} required value={form.model ?? ""} onChange={e => upd("model", e.target.value)} placeholder="p.ej. Symbia T16, NM/CT 870 DR" />
          </div>
          <div>
            <label className={labelCls}>Número de serie</label>
            <input className={inputCls} value={form.serial_number ?? ""} onChange={e => upd("serial_number", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Código interno (CCHEN / inventario)</label>
            <input className={inputCls} value={form.internal_code ?? ""} onChange={e => upd("internal_code", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>N° de cabezales (detectores)</label>
            <input type="number" min={1} max={3} className={inputCls} value={form.num_detectors ?? ""} onChange={e => upd("num_detectors", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Tipo de cristal</label>
            <input className={inputCls} value={form.crystal_type ?? ""} onChange={e => upd("crystal_type", e.target.value)} placeholder="NaI(Tl)" />
          </div>
          <div>
            <label className={labelCls}>Tamaño cristal (pulgadas)</label>
            <input type="number" step="0.1" className={inputCls} value={form.crystal_size_inch ?? ""} onChange={e => upd("crystal_size_inch", Number(e.target.value))} placeholder="p.ej. 15" />
          </div>
          <div>
            <label className={labelCls}>Campo de visión — dimensiones (cm)</label>
            <input className={inputCls} value={form.fov_dimensions ?? ""} onChange={e => upd("fov_dimensions", e.target.value)} placeholder="p.ej. 54 × 40 cm" />
          </div>
          <div>
            <label className={labelCls}>Resolución energética (%)</label>
            <input type="number" step="0.1" className={inputCls} value={form.energy_resolution_percent ?? ""} onChange={e => upd("energy_resolution_percent", Number(e.target.value))} placeholder="p.ej. 9.5" />
          </div>
          <div>
            <label className={labelCls}>Resolución intrínseca — FWHM (mm)</label>
            <input type="number" step="0.1" className={inputCls} value={form.intrinsic_resolution_fwhm_mm ?? ""} onChange={e => upd("intrinsic_resolution_fwhm_mm", Number(e.target.value))} placeholder="p.ej. 3.5" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Colimadores disponibles</label>
            <input className={inputCls} value={form.collimator_types ?? ""} onChange={e => upd("collimator_types", e.target.value)} placeholder="p.ej. LEHR, LEHS, LEUHR, MEGP, HEGP" />
          </div>
          <div>
            <label className={labelCls}>Software</label>
            <input className={inputCls} value={form.software_name ?? ""} onChange={e => upd("software_name", e.target.value)} placeholder="p.ej. eSoft, xSPECT" />
          </div>
          <div>
            <label className={labelCls}>Versión de software</label>
            <input className={inputCls} value={form.software_version ?? ""} onChange={e => upd("software_version", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Fecha de instalación</label>
            <input type="date" className={inputCls} value={form.installation_date?.slice(0, 10) ?? ""} onChange={e => upd("installation_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fecha de aceptación</label>
            <input type="date" className={inputCls} value={form.acceptance_date?.slice(0, 10) ?? ""} onChange={e => upd("acceptance_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Última calibración</label>
            <input type="date" className={inputCls} value={form.last_calibration_date?.slice(0, 10) ?? ""} onChange={e => upd("last_calibration_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Último servicio técnico</label>
            <input type="date" className={inputCls} value={form.last_service_date?.slice(0, 10) ?? ""} onChange={e => upd("last_service_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>N° autorización DS 133/1984</label>
            <input className={inputCls} value={form.authorization_number ?? ""} onChange={e => upd("authorization_number", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Vencimiento autorización</label>
            <input type="date" className={inputCls} value={form.authorization_expiry_date?.slice(0, 10) ?? ""} onChange={e => upd("authorization_expiry_date", e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Observaciones</label>
          <textarea
            className={`${inputCls} resize-y`}
            rows={3}
            value={form.notes ?? ""}
            onChange={e => upd("notes", e.target.value)}
          />
        </div>

        {message && (
          <p className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : selectedId ? "Actualizar ficha" : "Registrar equipo"}
          </button>
          {selectedId && (
            <button type="button" onClick={() => select(null)} className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
