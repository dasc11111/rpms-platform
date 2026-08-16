"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, ClipboardList, Warehouse, ShieldCheck, Radiation,
  AlertTriangle, CalendarClock, GraduationCap, History, Plus, Atom, Gauge, ListChecks, ShieldAlert,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "@/components/auth/auth-provider";
import { CentroOperaciones } from "./centro-operaciones";
import { LinacApp } from "@/components/linac/linac-app";
import { GestionIntegralTab } from "./gestion-integral";
import { AccionesTab } from "./acciones";
import { RiesgosTab } from "./riesgos";
import { IncidentesTab } from "./incidentes";

const TABS = [
  { id: "dashboard", label: "Dashboard Ejecutivo", icon: LayoutDashboard },
  { id: "gestion-integral", label: "Gestion Integral", icon: Gauge },
  { id: "actions", label: "Acciones Correctivas/Preventivas", icon: ListChecks },
  { id: "risks", label: "Gestion de Riesgos", icon: ShieldAlert },
  { id: "info", label: "Informacion General", icon: ClipboardList },
  { id: "linac", label: "Acelerador Lineal", icon: Atom },
  { id: "bunkers", label: "Bunkers y Blindaje", icon: Warehouse },
  { id: "safety", label: "Dispositivos de Seguridad", icon: ShieldCheck },
  { id: "surveys", label: "Levantamientos Radiometricos", icon: Radiation },
  { id: "incidents", label: "Incidentes", icon: AlertTriangle },
  { id: "audits", label: "Auditorias", icon: CalendarClock },
  { id: "training", label: "Capacitacion y Competencias", icon: GraduationCap },
  { id: "history", label: "Historial", icon: History },
];

const DEVICE_TYPES = [
  { value: "interlock", label: "Interlock" },
  { value: "alarma", label: "Alarma" },
  { value: "puerta", label: "Puerta blindada" },
  { value: "monitor_area", label: "Monitor de area" },
];
const AUDIT_TYPES = ["interna", "externa", "seremi", "cchen", "iaea"];
const INCIDENT_SEVERITIES = ["menor", "moderado", "grave"];
const SEVERITY_COLORS: Record<string, string> = { menor: "text-success", moderado: "text-warning", grave: "text-danger" };

export function RadioterapiaApp() {
  const { user } = useAuth();
  const actorEmail = user?.email || null;
  const [tab, setTab] = useState("dashboard");
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);

  const loadFacilities = useCallback(async () => {
    const res = await fetch("/api/radioterapia");
    const data = await res.json();
    if (data.ok) {
      setFacilities(data.facilities);
      if (!facilityId && data.facilities[0]) setFacilityId(data.facilities[0].id);
    }
  }, [facilityId]);

  const loadDashboard = useCallback(async () => {
    if (!facilityId) return;
    const res = await fetch("/api/radioterapia/dashboard?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) setDashboard(data);
  }, [facilityId]);

  useEffect(() => { loadFacilities(); }, [loadFacilities]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const selectedFacility = facilities.find((f: any) => f.id === facilityId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Radioterapia (SIGR)</h1>
          <p className="text-sm text-muted-foreground">
            Gestion integral del servicio de radioterapia: bunkers, blindaje, seguridad radiologica, incidentes, auditorias y capacitacion
          </p>
        </div>
        <select
          value={facilityId || ""}
          onChange={(e) => setFacilityId(Number(e.target.value))}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          {facilities.length === 0 && <option value="">Sin instalaciones registradas</option>}
          {facilities.map((f: any) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t: any) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs " +
                (active ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <CentroOperaciones dashboard={dashboard} facilityName={selectedFacility?.name} />}    
      {tab === "info" && (
        <InfoTab facility={selectedFacility} actorEmail={actorEmail} onCreated={loadFacilities} />
      )}
      {tab === "linac" && <LinacApp />}
      {tab === "gestion-integral" && facilityId && <GestionIntegralTab facilityId={facilityId} />}
      {tab === "bunkers" && facilityId && <BunkersTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "safety" && facilityId && <SafetyTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "surveys" && facilityId && <SurveysTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "incidents" && facilityId && <IncidentesTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "actions" && facilityId && <AccionesTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "risks" && facilityId && <RiesgosTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "audits" && facilityId && <AuditsTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "training" && facilityId && <TrainingTab facilityId={facilityId} actorEmail={actorEmail} />}
      {tab === "history" && <HistoryTab />}
      {!facilityId && tab !== "dashboard" && tab !== "info" && tab !== "history" && (
        <p className="text-sm text-muted-foreground">
          Primero registra una instalacion en &quot;Informacion General&quot;.
        </p>
      )}
    </div>
  );
}

function KpiBox({ label, value }: any) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DashboardTab({ dashboard }: any) {
  if (!dashboard) return <p className="text-sm text-muted-foreground">Cargando dashboard...</p>;
  const k = dashboard.kpis || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <KpiBox label="Bunkers" value={k.bunkers} />
        <KpiBox label="Dispositivos" value={k.devicesTotal} />
        <KpiBox label="Operativos" value={k.devicesOperational} />
        <KpiBox label="Incidentes abiertos" value={k.incidentsOpen} />
        <KpiBox label="Quasi-incidentes" value={k.nearMiss} />
        <KpiBox label="Auditorias abiertas" value={k.auditsOpen} />
        <KpiBox label="Capacitaciones por vencer" value={k.trainingExpiring} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Incidentes por severidad</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dashboard.incidentsBySeverity || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="severity" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Ultimos levantamientos radiometricos</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dashboard.recentSurveys || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="survey_date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(0, 10)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="measured_value" stroke="#22c55e" name="Valor medido" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function InfoTab({ facility, actorEmail, onCreated }: any) {
  const [form, setForm] = useState<any>({ name: "", address: "", responsibleQa: "", description: "" });
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";
  const labelCls = "text-xs text-muted-foreground";

  function set(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, actorEmail }),
      });
      setForm({ name: "", address: "", responsibleQa: "", description: "" });
      onCreated && onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {facility && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-sm font-semibold text-foreground">Instalacion seleccionada: {facility.name}</p>
          <p className="text-xs text-muted-foreground">
            {facility.address || "Sin direccion registrada"} - Responsable QA: {facility.responsible_qa || "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{facility.description || ""}</p>
        </div>
      )}
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar nueva instalacion de radioterapia</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={labelCls}>Nombre</label><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={labelCls}>Direccion</label><input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><label className={labelCls}>Responsable QA</label><input className={inputCls} value={form.responsibleQa} onChange={(e) => set("responsibleQa", e.target.value)} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls}>Descripcion</label><input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Crear instalacion"}
        </button>
      </div>
    </div>
  );
}
function BunkersTab({ facilityId, actorEmail }: any) {
  const [bunkers, setBunkers] = useState<any[]>([]);
  const [bunkerId, setBunkerId] = useState<number | null>(null);
  const [shielding, setShielding] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [shieldForm, setShieldForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const loadBunkers = useCallback(async () => {
    const res = await fetch("/api/radioterapia/bunkers?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) {
      setBunkers(data.bunkers);
      if (!bunkerId && data.bunkers[0]) setBunkerId(data.bunkers[0].id);
    }
  }, [facilityId, bunkerId]);

  const loadShielding = useCallback(async () => {
    if (!bunkerId) return;
    const res = await fetch("/api/radioterapia/bunkers?bunkerId=" + bunkerId);
    const data = await res.json();
    if (data.ok) setShielding(data.shielding);
  }, [bunkerId]);

  useEffect(() => { loadBunkers(); }, [loadBunkers]);
  useEffect(() => { loadShielding(); }, [loadShielding]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function setShield(k: string, v: any) { setShieldForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSaveBunker() {
    if (!form.name) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/bunkers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({});
      loadBunkers();
    } finally { setSaving(false); }
  }

  async function handleSaveShielding() {
    if (!bunkerId || !shieldForm.element) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/bunkers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "shielding", bunkerId, actorEmail, ...shieldForm }),
      });
      setShieldForm({});
      loadShielding();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar bunker</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className={inputCls} placeholder="Nombre del bunker" value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          <input className={inputCls} placeholder="Referencia de diseno" value={form.designReference || ""} onChange={(e) => set("designReference", e.target.value)} />
        </div>
        <button onClick={handleSaveBunker} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar bunker"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Bunkers registrados</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Nombre</th><th className="p-1">Referencia</th><th className="p-1">Estado</th><th className="p-1">Seleccionar</th>
          </tr></thead>
          <tbody>
            {bunkers.map((b: any) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-1 text-foreground">{b.name}</td>
                <td className="p-1 text-foreground">{b.design_reference || "-"}</td>
                <td className="p-1 text-foreground">{b.status}</td>
                <td className="p-1">
                  <button
                    onClick={() => setBunkerId(b.id)}
                    className={"rounded border border-border px-1.5 py-0.5 " + (bunkerId === b.id ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-background")}
                  >
                    {bunkerId === b.id ? "Seleccionado" : "Seleccionar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bunkerId && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Blindaje del bunker seleccionado</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <input className={inputCls} placeholder="Elemento" value={shieldForm.element || ""} onChange={(e) => setShield("element", e.target.value)} />
            <input className={inputCls} placeholder="Material" value={shieldForm.material || ""} onChange={(e) => setShield("material", e.target.value)} />
            <input type="number" className={inputCls} placeholder="Espesor (cm)" value={shieldForm.thicknessCm || ""} onChange={(e) => setShield("thicknessCm", e.target.value)} />
            <input className={inputCls} placeholder="Referencia de calculo" value={shieldForm.calculationReference || ""} onChange={(e) => setShield("calculationReference", e.target.value)} />
            <input type="date" className={inputCls} value={shieldForm.verificationDate || ""} onChange={(e) => setShield("verificationDate", e.target.value)} />
          </div>
          <button onClick={handleSaveShielding} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar blindaje"}
          </button>
          <table className="mt-3 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Elemento</th><th className="p-1">Material</th><th className="p-1">Espesor</th><th className="p-1">Verificacion</th><th className="p-1">Estado</th>
            </tr></thead>
            <tbody>
              {shielding.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-1 text-foreground">{s.element}</td>
                  <td className="p-1 text-foreground">{s.material || "-"}</td>
                  <td className="p-1 text-foreground">{s.thickness_cm || "-"}</td>
                  <td className="p-1 text-foreground">{s.verification_date ? String(s.verification_date).slice(0, 10) : "-"}</td>
                  <td className="p-1 text-foreground">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SafetyTab({ facilityId, actorEmail }: any) {
  const [bunkers, setBunkers] = useState<any[]>([]);
  const [bunkerId, setBunkerId] = useState<number | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [checks, setChecks] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [checkForm, setCheckForm] = useState<any>({ result: "conforme" });
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const loadBunkers = useCallback(async () => {
    const res = await fetch("/api/radioterapia/bunkers?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) {
      setBunkers(data.bunkers);
      if (!bunkerId && data.bunkers[0]) setBunkerId(data.bunkers[0].id);
    }
  }, [facilityId, bunkerId]);

  const loadDevices = useCallback(async () => {
    if (!bunkerId) return;
    const res = await fetch("/api/radioterapia/safety?bunkerId=" + bunkerId);
    const data = await res.json();
    if (data.ok) {
      setDevices(data.devices);
      if (!deviceId && data.devices[0]) setDeviceId(data.devices[0].id);
    }
  }, [bunkerId, deviceId]);

  const loadChecks = useCallback(async () => {
    if (!deviceId) return;
    const res = await fetch("/api/radioterapia/safety?deviceId=" + deviceId);
    const data = await res.json();
    if (data.ok) setChecks(data.checks);
  }, [deviceId]);

  useEffect(() => { loadBunkers(); }, [loadBunkers]);
  useEffect(() => { loadDevices(); }, [loadDevices]);
  useEffect(() => { loadChecks(); }, [loadChecks]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }
  function setCheck(k: string, v: any) { setCheckForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSaveDevice() {
    if (!bunkerId || !form.deviceType) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bunkerId, actorEmail, ...form }),
      });
      setForm({});
      loadDevices();
    } finally { setSaving(false); }
  }

  async function handleSaveCheck() {
    if (!deviceId || !checkForm.checkDate) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "check", deviceId, actorEmail, ...checkForm }),
      });
      setCheckForm({ result: "conforme" });
      loadChecks();
      loadDevices();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {bunkers.map((b: any) => (
          <button
            key={b.id}
            onClick={() => { setBunkerId(b.id); setDeviceId(null); }}
            className={"rounded px-2 py-1 text-xs " + (bunkerId === b.id ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {b.name}
          </button>
        ))}
      </div>

      {bunkerId && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Registrar dispositivo de seguridad</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <select className={inputCls} value={form.deviceType || ""} onChange={(e) => set("deviceType", e.target.value)}>
              <option value="">Tipo</option>
              {DEVICE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
            <input className={inputCls} placeholder="Nombre" value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
            <input className={inputCls} placeholder="Ubicacion" value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
          </div>
          <button onClick={handleSaveDevice} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar dispositivo"}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Dispositivos del bunker seleccionado</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Tipo</th><th className="p-1">Nombre</th><th className="p-1">Ubicacion</th><th className="p-1">Estado</th><th className="p-1">Seleccionar</th>
          </tr></thead>
          <tbody>
            {devices.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-1 text-foreground">{d.device_type}</td>
                <td className="p-1 text-foreground">{d.name || "-"}</td>
                <td className="p-1 text-foreground">{d.location || "-"}</td>
                <td className={"p-1 font-medium " + (d.status === "operativo" || d.status === "conforme" ? "text-success" : "text-danger")}>{d.status}</td>
                <td className="p-1">
                  <button
                    onClick={() => setDeviceId(d.id)}
                    className={"rounded border border-border px-1.5 py-0.5 " + (deviceId === d.id ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-background")}
                  >
                    {deviceId === d.id ? "Seleccionado" : "Seleccionar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deviceId && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Registrar verificacion del dispositivo</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input type="date" className={inputCls} value={checkForm.checkDate || ""} onChange={(e) => setCheck("checkDate", e.target.value)} />
            <select className={inputCls} value={checkForm.result || "conforme"} onChange={(e) => setCheck("result", e.target.value)}>
              <option value="conforme">Conforme</option>
              <option value="no_conforme">No conforme</option>
            </select>
            <input className={inputCls} placeholder="Responsable" value={checkForm.responsible || ""} onChange={(e) => setCheck("responsible", e.target.value)} />
            <input className={inputCls} placeholder="Observaciones" value={checkForm.observations || ""} onChange={(e) => setCheck("observations", e.target.value)} />
          </div>
          <button onClick={handleSaveCheck} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar verificacion"}
          </button>
          <table className="mt-3 w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Fecha</th><th className="p-1">Resultado</th><th className="p-1">Responsable</th><th className="p-1">Observaciones</th>
            </tr></thead>
            <tbody>
              {checks.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-1 text-foreground">{String(c.check_date).slice(0, 10)}</td>
                  <td className={"p-1 font-medium " + (c.result === "conforme" ? "text-success" : "text-danger")}>{c.result}</td>
                  <td className="p-1 text-foreground">{c.responsible || "-"}</td>
                  <td className="p-1 text-foreground">{c.observations || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function SurveysTab({ facilityId, actorEmail }: any) {
  const [bunkers, setBunkers] = useState<any[]>([]);
  const [bunkerId, setBunkerId] = useState<number | null>(null);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const loadBunkers = useCallback(async () => {
    const res = await fetch("/api/radioterapia/bunkers?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) {
      setBunkers(data.bunkers);
      if (!bunkerId && data.bunkers[0]) setBunkerId(data.bunkers[0].id);
    }
  }, [facilityId, bunkerId]);

  const loadSurveys = useCallback(async () => {
    if (!bunkerId) return;
    const res = await fetch("/api/radioterapia/surveys?bunkerId=" + bunkerId);
    const data = await res.json();
    if (data.ok) setSurveys(data.surveys);
  }, [bunkerId]);

  useEffect(() => { loadBunkers(); }, [loadBunkers]);
  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!bunkerId || !form.surveyDate) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bunkerId, actorEmail, ...form }),
      });
      setForm({});
      loadSurveys();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {bunkers.map((b: any) => (
          <button
            key={b.id}
            onClick={() => setBunkerId(b.id)}
            className={"rounded px-2 py-1 text-xs " + (bunkerId === b.id ? "bg-accent-subtle text-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar levantamiento radiometrico</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input type="date" className={inputCls} value={form.surveyDate || ""} onChange={(e) => set("surveyDate", e.target.value)} />
          <input className={inputCls} placeholder="Ubicacion" value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
          <input type="number" className={inputCls} placeholder="Valor medido" value={form.measuredValue || ""} onChange={(e) => set("measuredValue", e.target.value)} />
          <input className={inputCls} placeholder="Unidad" value={form.unit || "uSv/h"} onChange={(e) => set("unit", e.target.value)} />
          <input className={inputCls} placeholder="Instrumento" value={form.instrumentRef || ""} onChange={(e) => set("instrumentRef", e.target.value)} />
          <input className={inputCls} placeholder="Responsable" value={form.responsible || ""} onChange={(e) => set("responsible", e.target.value)} />
        </div>
        <input className={inputCls + " mt-2"} placeholder="Observaciones" value={form.observations || ""} onChange={(e) => set("observations", e.target.value)} />
        <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar levantamiento"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Fecha</th><th className="p-1">Ubicacion</th><th className="p-1">Valor</th><th className="p-1">Instrumento</th><th className="p-1">Responsable</th>
          </tr></thead>
          <tbody>
            {surveys.map((s: any) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(s.survey_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{s.location || "-"}</td>
                <td className="p-1 text-foreground">{s.measured_value} {s.unit}</td>
                <td className="p-1 text-foreground">{s.instrument_ref || "-"}</td>
                <td className="p-1 text-foreground">{s.responsible || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentsTab({ facilityId, actorEmail }: any) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ severity: "menor", isNearMiss: false });
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const load = useCallback(async () => {
    const res = await fetch("/api/radioterapia/incidents?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) setList(data.incidents);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.event || !form.incidentDate) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({ severity: "menor", isNearMiss: false });
      load();
    } finally { setSaving(false); }
  }

  async function toggleStatus(id: number, status: string) {
    await fetch("/api/radioterapia/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, actorEmail }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar incidente / quasi-incidente</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="Evento" value={form.event || ""} onChange={(e) => set("event", e.target.value)} />
          <input type="date" className={inputCls} value={form.incidentDate || ""} onChange={(e) => set("incidentDate", e.target.value)} />
          <select className={inputCls} value={form.severity || "menor"} onChange={(e) => set("severity", e.target.value)}>
            {INCIDENT_SEVERITIES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={!!form.isNearMiss} onChange={(e) => set("isNearMiss", e.target.checked)} />
            Quasi-incidente
          </label>
        </div>
        <textarea className={inputCls + " mt-2"} placeholder="Descripcion" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Causa" value={form.cause || ""} onChange={(e) => set("cause", e.target.value)} />
          <input className={inputCls} placeholder="Acciones correctivas" value={form.correctiveActions || ""} onChange={(e) => set("correctiveActions", e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar incidente"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Fecha</th><th className="p-1">Evento</th><th className="p-1">Severidad</th><th className="p-1">Quasi</th><th className="p-1">Estado</th><th className="p-1">Accion</th>
          </tr></thead>
          <tbody>
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(r.incident_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{r.event}</td>
                <td className={"p-1 font-medium " + (SEVERITY_COLORS[r.severity] || "text-foreground")}>{r.severity}</td>
                <td className="p-1 text-foreground">{r.is_near_miss ? "Si" : "No"}</td>
                <td className={"p-1 font-medium " + (r.status === "abierto" ? "text-danger" : "text-success")}>{r.status}</td>
                <td className="p-1">
                  <button
                    onClick={() => toggleStatus(r.id, r.status === "abierto" ? "cerrado" : "abierto")}
                    className="rounded border border-border px-1.5 py-0.5 text-foreground hover:bg-background"
                  >
                    {r.status === "abierto" ? "Cerrar" : "Reabrir"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditsTab({ facilityId, actorEmail }: any) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ status: "abierta" });
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const load = useCallback(async () => {
    const res = await fetch("/api/radioterapia/audits?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) setList(data.audits);
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.auditDate) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...form }),
      });
      setForm({ status: "abierta" });
      load();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar auditoria / inspeccion</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <select className={inputCls} value={form.auditType || ""} onChange={(e) => set("auditType", e.target.value)}>
            <option value="">Tipo</option>
            {AUDIT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <input type="date" className={inputCls} value={form.auditDate || ""} onChange={(e) => set("auditDate", e.target.value)} />
          <input className={inputCls} placeholder="Hallazgos" value={form.findings || ""} onChange={(e) => set("findings", e.target.value)} />
          <input className={inputCls} placeholder="No conformidades" value={form.nonconformities || ""} onChange={(e) => set("nonconformities", e.target.value)} />
          <input className={inputCls} placeholder="Acciones" value={form.actions || ""} onChange={(e) => set("actions", e.target.value)} />
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar auditoria"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Fecha</th><th className="p-1">Tipo</th><th className="p-1">Hallazgos</th><th className="p-1">No conformidades</th><th className="p-1">Estado</th>
          </tr></thead>
          <tbody>
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-1 text-foreground">{String(r.audit_date).slice(0, 10)}</td>
                <td className="p-1 text-foreground">{r.audit_type || "-"}</td>
                <td className="p-1 text-foreground">{r.findings || "-"}</td>
                <td className="p-1 text-foreground">{r.nonconformities || "-"}</td>
                <td className="p-1 text-foreground">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function TrainingTab({ facilityId, actorEmail }: any) {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [trainingForm, setTrainingForm] = useState<any>({ status: "vigente" });
  const [competencyForm, setCompetencyForm] = useState<any>({ result: "competente" });
  const [saving, setSaving] = useState(false);
  const inputCls = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  const loadTrainings = useCallback(async () => {
    const res = await fetch("/api/radioterapia/training?facilityId=" + facilityId);
    const data = await res.json();
    if (data.ok) setTrainings(data.trainings);
  }, [facilityId]);

  const loadCompetencies = useCallback(async () => {
    const res = await fetch("/api/radioterapia/training?facilityId=" + facilityId + "&kind=competency");
    const data = await res.json();
    if (data.ok) setCompetencies(data.competencies);
  }, [facilityId]);

  useEffect(() => { loadTrainings(); }, [loadTrainings]);
  useEffect(() => { loadCompetencies(); }, [loadCompetencies]);

  function setT(k: string, v: any) { setTrainingForm((f: any) => ({ ...f, [k]: v })); }
  function setC(k: string, v: any) { setCompetencyForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSaveTraining() {
    if (!trainingForm.workerName || !trainingForm.trainingName) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, actorEmail, ...trainingForm }),
      });
      setTrainingForm({ status: "vigente" });
      loadTrainings();
    } finally { setSaving(false); }
  }

  async function handleSaveCompetency() {
    if (!competencyForm.workerName || !competencyForm.competency) return;
    setSaving(true);
    try {
      await fetch("/api/radioterapia/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "competency", facilityId, actorEmail, ...competencyForm }),
      });
      setCompetencyForm({ result: "competente" });
      loadCompetencies();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar capacitacion</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="RUT trabajador" value={trainingForm.workerRut || ""} onChange={(e) => setT("workerRut", e.target.value)} />
          <input className={inputCls} placeholder="Nombre trabajador" value={trainingForm.workerName || ""} onChange={(e) => setT("workerName", e.target.value)} />
          <input className={inputCls} placeholder="Nombre capacitacion" value={trainingForm.trainingName || ""} onChange={(e) => setT("trainingName", e.target.value)} />
          <input type="date" className={inputCls} value={trainingForm.trainingDate || ""} onChange={(e) => setT("trainingDate", e.target.value)} />
          <input type="date" className={inputCls} value={trainingForm.expiryDate || ""} onChange={(e) => setT("expiryDate", e.target.value)} placeholder="Vencimiento" />
          <input className={inputCls} placeholder="Institucion" value={trainingForm.institution || ""} onChange={(e) => setT("institution", e.target.value)} />
        </div>
        <button onClick={handleSaveTraining} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar capacitacion"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Capacitaciones registradas</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Trabajador</th><th className="p-1">Capacitacion</th><th className="p-1">Fecha</th><th className="p-1">Vencimiento</th><th className="p-1">Estado</th>
          </tr></thead>
          <tbody>
            {trainings.map((t: any) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-1 text-foreground">{t.worker_name}</td>
                <td className="p-1 text-foreground">{t.training_name}</td>
                <td className="p-1 text-foreground">{t.training_date ? String(t.training_date).slice(0, 10) : "-"}</td>
                <td className="p-1 text-foreground">{t.expiry_date ? String(t.expiry_date).slice(0, 10) : "-"}</td>
                <td className="p-1 text-foreground">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Registrar evaluacion de competencias</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input className={inputCls} placeholder="RUT trabajador" value={competencyForm.workerRut || ""} onChange={(e) => setC("workerRut", e.target.value)} />
          <input className={inputCls} placeholder="Nombre trabajador" value={competencyForm.workerName || ""} onChange={(e) => setC("workerName", e.target.value)} />
          <input className={inputCls} placeholder="Competencia" value={competencyForm.competency || ""} onChange={(e) => setC("competency", e.target.value)} />
          <input type="date" className={inputCls} value={competencyForm.evaluationDate || ""} onChange={(e) => setC("evaluationDate", e.target.value)} />
          <select className={inputCls} value={competencyForm.result || "competente"} onChange={(e) => setC("result", e.target.value)}>
            <option value="competente">Competente</option>
            <option value="no_competente">No competente</option>
          </select>
          <input className={inputCls} placeholder="Evaluador" value={competencyForm.evaluator || ""} onChange={(e) => setC("evaluator", e.target.value)} />
        </div>
        <button onClick={handleSaveCompetency} disabled={saving} className="mt-2 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar evaluacion"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Evaluaciones de competencias</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="p-1">Trabajador</th><th className="p-1">Competencia</th><th className="p-1">Fecha</th><th className="p-1">Resultado</th><th className="p-1">Evaluador</th>
          </tr></thead>
          <tbody>
            {competencies.map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-1 text-foreground">{c.worker_name}</td>
                <td className="p-1 text-foreground">{c.competency}</td>
                <td className="p-1 text-foreground">{c.evaluation_date ? String(c.evaluation_date).slice(0, 10) : "-"}</td>
                <td className={"p-1 font-medium " + (c.result === "competente" ? "text-success" : "text-danger")}>{c.result}</td>
                <td className="p-1 text-foreground">{c.evaluator || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTab() {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/radioterapia/history").then((r) => r.json()).then((data) => {
      if (data.ok) setHistory(data.history);
    });
  }, []);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Historial de acciones</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground">
          <th className="p-1">Fecha</th><th className="p-1">Usuario</th><th className="p-1">Accion</th><th className="p-1">Detalle</th>
        </tr></thead>
        <tbody>
          {history.map((h: any) => (
            <tr key={h.id} className="border-t border-border">
              <td className="p-1 text-foreground">{new Date(h.created_at).toLocaleString()}</td>
              <td className="p-1 text-foreground">{h.actor_email || "-"}</td>
              <td className="p-1 text-foreground">{h.action}</td>
              <td className="p-1 text-muted-foreground">{JSON.stringify(h.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
