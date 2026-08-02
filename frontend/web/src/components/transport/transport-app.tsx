"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Plus, Search, Download, FileSpreadsheet, FileText, AlertTriangle, ShieldCheck, QrCode } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/components/auth/auth-provider";
import { downloadCsv } from "@/lib/csv";
import { AuthorizationPanel } from "@/components/transport/authorization-panel";
import { DispatchDocButton } from "@/components/transport/dispatch-doc-button";
import { ShipmentModal, type RadionuclideDef, type ShipmentRecord } from "@/components/transport/shipment-modal";

const MATERIAL_LABELS: Record<string, string> = {
  MO_TC99: "Generador Mo-99/Tc-99m",
  I131: "I-131",
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"];

const ALERT_LABELS: Record<string, string> = {
  dose_1m_exceeded: "Supera limite 1m",
  dose_vehicle_exceeded: "Supera limite vehiculo",
  missing_dosimeter: "Sin dosimetro",
  missing_radiactivo7: "Sin senal Radiactivo 7",
  missing_nu2915: "Sin panel NU 2915",
  missing_driver: "Sin conductor",
  missing_opr: "Sin OPR",
};

type DashboardStats = {
  totalTransports: number;
  transportsToday: number;
  transportsThisMonth: number;
  transportsThisYear: number;
  materialCounts: Record<string, number>;
  averages: { it: number; doseContact: number; dose1m: number; doseVehicle: number };
  exceededLimits: number;
  compliance: { total: number; dosimeterPct: number; radiactivo7Pct: number; nu2915Pct: number; driverPct: number; oprPct: number };
  generatorStats: { total: number; totalActivityMci: number; avgActivityMci: number; maxActivityMci: number; minActivityMci: number };
  i131Stats: { totalShipments: number; totalCapsules: number; totalActivityMci: number; avgActivityMci: number; maxActivityMci: number; minActivityMci: number };
  monthlyTrend: { month: string; total: number }[];
  yearlyTrend: { year: number; total: number }[];
  authorization: { number: string | null; issuedDate: string | null; expiryDate: string | null; daysRemaining: number | null; alertLevel: string } | null;
};

type NormalizedShipment = ShipmentRecord & { alerts: string[] };

function computeAlertsClient(row: any): string[] {
  const alerts: string[] = [];
  const dose1m = row.dose1m ?? row.dose_1m;
  const doseVehicle = row.doseVehicle ?? row.dose_vehicle;
  const signageDosimeter = row.signageDosimeter ?? row.signage_dosimeter;
  const signageRadiactivo7 = row.signageRadiactivo7 ?? row.signage_radiactivo7;
  const signageNu2915 = row.signageNu2915 ?? row.signage_nu2915;
  const driverName = row.driverName ?? row.driver_name;
  const oprName = row.oprName ?? row.opr_name;
  if (dose1m !== null && dose1m !== undefined && Number(dose1m) > 100) alerts.push("dose_1m_exceeded");
  if (doseVehicle !== null && doseVehicle !== undefined && Number(doseVehicle) > 2000) alerts.push("dose_vehicle_exceeded");
  if (!signageDosimeter) alerts.push("missing_dosimeter");
  if (!signageRadiactivo7) alerts.push("missing_radiactivo7");
  if (!signageNu2915) alerts.push("missing_nu2915");
  if (!driverName) alerts.push("missing_driver");
  if (!oprName) alerts.push("missing_opr");
  return alerts;
}

function normalizeShipment(raw: any): NormalizedShipment {
  if (raw.transportDate !== undefined) {
    return raw as NormalizedShipment;
  }
  return {
    id: raw.id,
    transportDate: raw.transport_date,
    correlativeNumber: raw.correlative_number,
    itValue: raw.it_value !== null && raw.it_value !== undefined ? Number(raw.it_value) : null,
    doseContact: raw.dose_contact !== null && raw.dose_contact !== undefined ? Number(raw.dose_contact) : null,
    dose1m: raw.dose_1m !== null && raw.dose_1m !== undefined ? Number(raw.dose_1m) : null,
    doseVehicle: raw.dose_vehicle !== null && raw.dose_vehicle !== undefined ? Number(raw.dose_vehicle) : null,
    materialCode: raw.material_code,
    requestedActivityMci:
      raw.requested_activity_mci !== null && raw.requested_activity_mci !== undefined
        ? Number(raw.requested_activity_mci)
        : null,
    i131Activities: (raw.i131_activities || []).map((a: any) => ({
      id: a.id,
      label: a.label,
      activityMci: a.activityMci !== null && a.activityMci !== undefined ? Number(a.activityMci) : null,
    })),
    driverName: raw.driver_name,
    oprName: raw.opr_name,
    signageDosimeter: raw.signage_dosimeter,
    signageRadiactivo7: raw.signage_radiactivo7,
    signageNu2915: raw.signage_nu2915,
    notes: raw.notes,
    alerts: computeAlertsClient(raw),
  };
}

export function TransportApp({
  initialShipments,
  radionuclides,
  initialAuthorization,
}: {
  initialShipments: any[];
  radionuclides: RadionuclideDef[];
  initialAuthorization: any | null;
}) {
  const { user } = useAuth();
  const actorEmail = user?.email || "sistema";
  void initialAuthorization;

  const [shipments, setShipments] = useState<NormalizedShipment[]>(() => initialShipments.map(normalizeShipment));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState("");
  const [opr, setOpr] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShipmentRecord | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (material) params.set("material", material);
      if (opr) params.set("opr", opr);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (day) params.set("day", day);
      if (month) params.set("month", month);
      if (year) params.set("year", year);
      const res = await fetch("/api/transport?" + params.toString());
      const data = await res.json().catch(() => ({}));
      setShipments((data.shipments || []).map(normalizeShipment));
    } finally {
      setLoading(false);
    }
  }, [search, material, opr, dateFrom, dateTo, day, month, year]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/transport/dashboard");
    const data = await res.json().catch(() => ({}));
    if (data.ok) setStats(data);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadShipments();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, material, opr, dateFrom, dateTo, day, month, year]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const shipmentId = sp.get("shipment");
    if (!shipmentId) return;
    const existing = shipments.find((s) => String(s.id) === shipmentId);
    if (existing) {
      setEditing(existing);
      setDefaultDate("");
      setModalOpen(true);
      return;
    }
    fetch("/api/transport/" + shipmentId)
      .then((r) => r.json())
      .then((data) => {
        if (data.shipment) {
          const normalized = normalizeShipment(data.shipment);
          setEditing(normalized);
          setDefaultDate("");
          setModalOpen(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, NormalizedShipment[]>();
    for (const s of shipments) {
      const key = String(s.transportDate).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [shipments]);

  const materialPieData = useMemo(() => {
    if (!stats) return [] as { name: string; value: number }[];
    return Object.entries(stats.materialCounts).map(([code, total]) => ({
      name: MATERIAL_LABELS[code] || code,
      value: total,
    }));
  }, [stats]);

  const complianceData = useMemo(() => {
    if (!stats) return [] as { name: string; value: number }[];
    return [
      { name: "Dosimetro", value: stats.compliance.dosimeterPct },
      { name: "Radiactivo 7", value: stats.compliance.radiactivo7Pct },
      { name: "NU 2915", value: stats.compliance.nu2915Pct },
      { name: "OPR asignado", value: stats.compliance.oprPct },
    ];
  }, [stats]);

  const activityData = useMemo(() => {
    if (!stats) return [] as { name: string; value: number }[];
    return [
      { name: "Tc-99m", value: Number(stats.generatorStats.totalActivityMci.toFixed(1)) },
      { name: "I-131", value: Number(stats.i131Stats.totalActivityMci.toFixed(1)) },
    ];
  }, [stats]);

  const complianceAvg =
    stats
      ? Math.round(
          (stats.compliance.dosimeterPct +
            stats.compliance.radiactivo7Pct +
            stats.compliance.nu2915Pct +
            stats.compliance.oprPct) /
            4
        )
      : null;

  function openNew(date?: string) {
    setEditing(null);
    setDefaultDate(date || new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  function openEdit(record: ShipmentRecord) {
    setEditing(record);
    setDefaultDate("");
    setModalOpen(true);
  }

  async function handleSaved() {
    await Promise.all([loadShipments(), loadStats()]);
  }

  function activityOf(s: NormalizedShipment): number | null {
    if (s.materialCode === "I131") {
      return s.i131Activities.reduce((acc, a) => acc + (a.activityMci || 0), 0);
    }
    return s.requestedActivityMci;
  }

  function exportCsv() {
    downloadCsv(
      "transporte-material-radiactivo-" + new Date().toISOString().slice(0, 10) + ".csv",
      shipments.map((s) => ({
        fecha: String(s.transportDate).slice(0, 10),
        numero: s.correlativeNumber,
        it: s.itValue ?? "",
        contacto: s.doseContact ?? "",
        dosis1m: s.dose1m ?? "",
        dosisVehiculo: s.doseVehicle ?? "",
        material: MATERIAL_LABELS[s.materialCode] || s.materialCode,
        actividad: activityOf(s) ?? "",
        opr: s.oprName ?? "",
        conductor: s.driverName ?? "",
        alertas: s.alerts.map((a) => ALERT_LABELS[a] || a).join(" | "),
      })),
      [
        { key: "fecha", label: "Fecha" },
        { key: "numero", label: "N Transporte" },
        { key: "it", label: "IT" },
        { key: "contacto", label: "Contacto (uSv/h)" },
        { key: "dosis1m", label: "1m (uSv/h)" },
        { key: "dosisVehiculo", label: "Vehiculo (uSv/h)" },
        { key: "material", label: "Material" },
        { key: "actividad", label: "Actividad (mCi)" },
        { key: "opr", label: "OPR" },
        { key: "conductor", label: "Conductor" },
        { key: "alertas", label: "Alertas" },
      ]
    );
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = shipments.map((s) => ({
      Fecha: String(s.transportDate).slice(0, 10),
      NTransporte: s.correlativeNumber,
      IT: s.itValue ?? "",
      ContactoUSvH: s.doseContact ?? "",
      Dosis1mUSvH: s.dose1m ?? "",
      DosisVehiculoUSvH: s.doseVehicle ?? "",
      Material: MATERIAL_LABELS[s.materialCode] || s.materialCode,
      ActividadMci: activityOf(s) ?? "",
      Conductor: s.driverName ?? "",
      OPR: s.oprName ?? "",
      Alertas: s.alerts.map((a) => ALERT_LABELS[a] || a).join(" | "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transporte");
    XLSX.writeFile(wb, "transporte-material-radiactivo-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" }) as unknown as {
      text: (t: string, x: number, y: number) => void;
      autoTable: (opts: Record<string, unknown>) => void;
      save: (filename: string) => void;
    };
    doc.text("Transporte de Material Radiactivo - Reporte", 40, 30);
    const head = [["Fecha", "N", "IT", "Contacto", "1m", "Vehiculo", "Material", "Actividad (mCi)", "OPR", "Alertas"]];
    const body = shipments.map((s) => {
      const act = activityOf(s);
      return [
        String(s.transportDate).slice(0, 10),
        String(s.correlativeNumber),
        s.itValue !== null ? String(s.itValue) : "",
        s.doseContact !== null ? String(s.doseContact) : "",
        s.dose1m !== null ? String(s.dose1m) : "",
        s.doseVehicle !== null ? String(s.doseVehicle) : "",
        MATERIAL_LABELS[s.materialCode] || s.materialCode,
        act !== null && act !== undefined ? Number(act).toFixed(2) : "",
        s.oprName || "",
        s.alerts.map((a) => ALERT_LABELS[a] || a).join(", "),
      ];
    });
    doc.autoTable({ head, body, startY: 45, styles: { fontSize: 7 }, headStyles: { fillColor: [30, 64, 175] } });
    doc.save("transporte-material-radiactivo-" + new Date().toISOString().slice(0, 10) + ".pdf");
  }

  async function generateShipmentPdf(r: NormalizedShipment) {
    const { jsPDF } = await import("jspdf");
    const QRCode = (await import("qrcode")).default;
    const url = window.location.origin + "/transport?shipment=" + r.id;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    const doc = new jsPDF({ unit: "pt" }) as unknown as {
      setFontSize: (n: number) => void;
      text: (t: string, x: number, y: number) => void;
      addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
      line: (x1: number, y1: number, x2: number, y2: number) => void;
      save: (filename: string) => void;
    };
    doc.setFontSize(14);
    doc.text("Formulario de Transporte de Material Radiactivo", 40, 40);
    doc.setFontSize(10);
    let y = 75;
    const line = (label: string, value: string) => {
      doc.text(label + ":", 40, y);
      doc.text(value, 230, y);
      y += 18;
    };
    line("N de Transporte", String(r.correlativeNumber));
    line("Fecha", String(r.transportDate).slice(0, 10));
    line("Indice de Transporte (IT)", r.itValue !== null ? String(r.itValue) : "-");
    line("Contacto con el bulto (uSv/h)", r.doseContact !== null ? String(r.doseContact) : "-");
    line("A 1 metro del bulto (uSv/h)", r.dose1m !== null ? String(r.dose1m) : "-");
    line("Contacto con el vehiculo (uSv/h)", r.doseVehicle !== null ? String(r.doseVehicle) : "-");
    line("Material transportado", MATERIAL_LABELS[r.materialCode] || r.materialCode);
    const activity = activityOf(r);
    line("Actividad (mCi)", activity !== null && activity !== undefined ? Number(activity).toFixed(2) : "-");
    line("Uso de Dosimetro", r.signageDosimeter ? "Si" : "No");
    line("Senal RADIACTIVO 7", r.signageRadiactivo7 ? "Si" : "No");
    line("Panel NU 2915", r.signageNu2915 ? "Si" : "No");
    line("Conductor", r.driverName || "-");
    line("OPR responsable", r.oprName || "-");

    doc.addImage(qrDataUrl, "PNG", 430, 60, 100, 100);
    doc.setFontSize(8);
    doc.text("Escanee para verificar en la plataforma", 415, 172);

    y += 30;
    doc.line(40, y + 40, 220, y + 40);
    doc.text("Firma Conductor", 40, y + 55);
    doc.line(300, y + 40, 480, y + 40);
    doc.text("Firma OPR", 300, y + 55);

    doc.save("transporte-" + r.correlativeNumber + "-" + String(r.transportDate).slice(0, 10) + ".pdf");
  }

  const authLevelStyle: Record<string, string> = {
    verde: "text-success",
    amarillo: "text-warning",
    naranjo: "text-orange-500",
    rojo: "text-danger",
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transporte de Material Radiactivo</h1>
          <p className="text-sm text-muted">Registro diario, trazabilidad y cumplimiento normativo (IAEA SSR-6)</p>
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus size={16} /> Nuevo transporte
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiBox label="Total transportes" value={stats?.totalTransports ?? "-"} />
        <KpiBox label="Hoy" value={stats?.transportsToday ?? "-"} />
        <KpiBox label="Este mes" value={stats?.transportsThisMonth ?? "-"} />
        <KpiBox label="Este ano" value={stats?.transportsThisYear ?? "-"} />
        <KpiBox label="Generadores Mo/Tc-99m" value={stats?.materialCounts?.MO_TC99 ?? 0} />
        <KpiBox label="Transportes I-131" value={stats?.materialCounts?.I131 ?? 0} />
        <KpiBox label="Actividad Tc-99m (mCi)" value={stats ? stats.generatorStats.totalActivityMci.toFixed(1) : "-"} />
        <KpiBox label="Actividad I-131 (mCi)" value={stats ? stats.i131Stats.totalActivityMci.toFixed(1) : "-"} />
        <KpiBox label="Promedio IT" value={stats ? stats.averages.it.toFixed(2) : "-"} />
        <KpiBox label="Prom. dosis 1m (uSv/h)" value={stats ? stats.averages.dose1m.toFixed(1) : "-"} />
        <KpiBox
          label="Excedieron limites"
          value={stats?.exceededLimits ?? 0}
          tone={stats && stats.exceededLimits > 0 ? "danger" : undefined}
          icon={stats && stats.exceededLimits > 0 ? <AlertTriangle size={14} /> : undefined}
        />
        <KpiBox label="% Cumplimiento normativo" value={complianceAvg !== null ? complianceAvg + "%" : "-"} />
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-xs text-muted">Autorizacion</p>
          {stats?.authorization ? (
            <p className={"mt-1 flex items-center gap-1 text-sm font-medium " + authLevelStyle[stats.authorization.alertLevel]}>
              <ShieldCheck size={14} />
              {stats.authorization.daysRemaining !== null ? stats.authorization.daysRemaining + " dias" : "Sin vencimiento"}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-danger">Sin autorizacion</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Dashboard Ejecutivo</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted">Transportes por mes (ultimos 12 meses)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Tendencia anual</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.yearlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Distribucion por radioisotopo</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={materialPieData} dataKey="value" nameKey="name" outerRadius={70} label>
                  {materialPieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Cumplimiento normativo (%)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={complianceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Actividad total por radioisotopo (mCi)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", fontSize: 12 }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <AuthorizationPanel actorEmail={actorEmail} />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por fecha, N, IT, conductor, OPR..."
            className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground"
          />
        </div>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">Todos los materiales</option>
          {radionuclides.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          value={opr}
          onChange={(e) => setOpr(e.target.value)}
          placeholder="OPR"
          className="w-28 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          placeholder="Dia"
          className="w-16 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="number"
          min={1}
          max={12}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="Mes"
          className="w-16 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Ano"
          className="w-20 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <button
          onClick={exportCsv}
          className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-background"
        >
          <Download size={12} /> CSV
        </button>
        <button
          onClick={exportExcel}
          className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-background"
        >
          <FileSpreadsheet size={12} /> Excel
        </button>
        <button
          onClick={exportPdf}
          className="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-background"
        >
          <FileText size={12} /> PDF
        </button>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted">Cargando...</p>}
        {!loading && grouped.length === 0 && (
          <p className="rounded border border-border bg-surface p-4 text-sm text-muted">
            No hay transportes registrados con los filtros seleccionados.
          </p>
        )}
        {grouped.map(([date, records]) => (
          <div key={date} className="rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{date}</h3>
                <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">
                  {records.length} transporte{records.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DispatchDocButton date={date} actorEmail={actorEmail} />
                <button
                  onClick={() => openNew(date)}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
                >
                  <Plus size={12} /> Agregar transporte
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="p-2">N</th>
                    <th className="p-2">IT</th>
                    <th className="p-2">Contacto</th>
                    <th className="p-2">1m</th>
                    <th className="p-2">Vehiculo</th>
                    <th className="p-2">Material</th>
                    <th className="p-2">Actividad (mCi)</th>
                    <th className="p-2">Conductor</th>
                    <th className="p-2">OPR</th>
                    <th className="p-2">Alertas</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const activity = activityOf(r);
                    return (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="p-2 text-foreground">{r.correlativeNumber}</td>
                        <td className="p-2 text-foreground">{r.itValue ?? "-"}</td>
                        <td className="p-2 text-foreground">{r.doseContact ?? "-"}</td>
                        <td className={"p-2 " + (r.dose1m !== null && r.dose1m > 100 ? "font-bold text-danger" : "text-foreground")}>
                          {r.dose1m ?? "-"}
                        </td>
                        <td
                          className={
                            "p-2 " + (r.doseVehicle !== null && r.doseVehicle > 2000 ? "font-bold text-danger" : "text-foreground")
                          }
                        >
                          {r.doseVehicle ?? "-"}
                        </td>
                        <td className="p-2">
                          <span className="rounded bg-background px-2 py-0.5 text-foreground">
                            {MATERIAL_LABELS[r.materialCode] || r.materialCode}
                          </span>
                        </td>
                        <td className="p-2 text-foreground">
                          {activity !== null && activity !== undefined ? Number(activity).toFixed(2) : "-"}
                        </td>
                        <td className="p-2 text-foreground">
                          {r.driverName ? (
                            <Link
                              href={"/transport/drivers/" + encodeURIComponent(r.driverName)}
                              className="underline decoration-dotted hover:text-accent"
                            >
                              {r.driverName}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2 text-foreground">{r.oprName || "-"}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {r.alerts.map((a) => (
                              <span key={a} className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                                {ALERT_LABELS[a] || a}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(r)}
                              className="rounded border border-border px-2 py-1 text-foreground hover:bg-background"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => generateShipmentPdf(r)}
                              title="Generar formulario PDF con codigo QR"
                              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-foreground hover:bg-background"
                            >
                              <QrCode size={12} /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <ShipmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        radionuclides={radionuclides}
        editing={editing}
        defaultDate={defaultDate}
        actorEmail={actorEmail}
      />
    </div>
  );
}

function KpiBox({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: "danger";
  icon?: ReactNode;
}) {
  return (
    <div className={"rounded-lg border p-3 " + (tone === "danger" ? "border-danger/40 bg-danger/10" : "border-border bg-surface")}>
      <p className="text-xs text-muted">{label}</p>
      <p className={"mt-1 flex items-center gap-1 text-lg font-semibold " + (tone === "danger" ? "text-danger" : "text-foreground")}>
        {icon}
        {value}
      </p>
    </div>
  );
}
