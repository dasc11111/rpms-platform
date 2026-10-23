"use client";

/**
 * Ajustes de Notificaciones
 * Configuración de alertas de vencimientos, dosis e incidentes.
 */

import { useEffect, useState } from "react";
import { Bell, Save } from "lucide-react";

interface NotificationSettings {
  email_enabled: boolean;
  email_address: string;
  // Dosimetry
  alert_dosimetry_overdue: boolean;
  alert_dosimetry_days_before: number;
  // Authorization expiry
  alert_worker_auth_expiry: boolean;
  alert_worker_auth_days_before: number;
  // Calibration
  alert_calibration_expiry: boolean;
  alert_calibration_days_before: number;
  // Equipment authorization
  alert_equipment_auth_expiry: boolean;
  alert_equipment_auth_days_before: number;
  // Incidents
  alert_incidents_grave: boolean;
  // Compliance
  alert_compliance_vencido: boolean;
  // Waste
  alert_waste_pending: boolean;
  // In-platform notifications
  platform_notifications: boolean;
}

const DEFAULTS: NotificationSettings = {
  email_enabled: false,
  email_address: "",
  alert_dosimetry_overdue: true,
  alert_dosimetry_days_before: 7,
  alert_worker_auth_expiry: true,
  alert_worker_auth_days_before: 30,
  alert_calibration_expiry: true,
  alert_calibration_days_before: 30,
  alert_equipment_auth_expiry: true,
  alert_equipment_auth_days_before: 30,
  alert_incidents_grave: true,
  alert_compliance_vencido: true,
  alert_waste_pending: true,
  platform_notifications: true,
};

export default function NotificationsSettingsPage() {
  const [form, setForm] = useState<NotificationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setForm({ ...DEFAULTS, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof NotificationSettings) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  function setNumber(key: keyof NotificationSettings, val: number) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function ToggleRow({
    label,
    description,
    fieldKey,
    daysKey,
  }: {
    label: string;
    description: string;
    fieldKey: keyof NotificationSettings;
    daysKey?: keyof NotificationSettings;
  }) {
    const checked = Boolean(form[fieldKey]);
    return (
      <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {daysKey && checked && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Alertar</label>
              <input
                type="number"
                min={1}
                max={180}
                value={Number(form[daysKey])}
                onChange={(e) => setNumber(daysKey, parseInt(e.target.value) || 7)}
                className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
              />
              <label className="text-xs text-muted-foreground">días antes del vencimiento</label>
            </div>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => toggle(fieldKey)}
          className={`mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            checked ? "bg-accent" : "bg-muted"
          } relative`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="text-sm text-muted-foreground">Cargando ajustes...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Notificaciones</h1>
          <p className="text-xs text-muted-foreground">
            Alertas automáticas de vencimientos, incidentes y actividad regulatoria.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email notifications */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Notificaciones por correo</h2>
          <ToggleRow
            label="Habilitar correo electrónico"
            description="Envía alertas a la dirección configurada cuando se detecten problemas."
            fieldKey="email_enabled"
          />
          {form.email_enabled && (
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1">Dirección de correo</label>
              <input
                type="email"
                value={form.email_address}
                onChange={(e) => setForm((f) => ({ ...f, email_address: e.target.value }))}
                placeholder="opr@establecimiento.cl"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* In-platform */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Notificaciones en la plataforma</h2>
          <ToggleRow
            label="Notificaciones en pantalla"
            description="Muestra alertas en el panel cuando hay eventos que requieren atención."
            fieldKey="platform_notifications"
          />
        </div>

        {/* Alert types */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Tipos de alerta</h2>
          <ToggleRow
            label="Dosímetros vencidos sin retornar"
            description="Alerta cuando un dosímetro supera su fecha de entrega sin ser devuelto."
            fieldKey="alert_dosimetry_overdue"
          />
          <ToggleRow
            label="Vencimiento de autorización de trabajadores"
            description="Alerta anticipada cuando la autorización de desempeño se acerca al vencimiento."
            fieldKey="alert_worker_auth_expiry"
            daysKey="alert_worker_auth_days_before"
          />
          <ToggleRow
            label="Vencimiento de calibración de instrumentos"
            description="Alerta cuando la calibración de un instrumento de medición está próxima a vencer."
            fieldKey="alert_calibration_expiry"
            daysKey="alert_calibration_days_before"
          />
          <ToggleRow
            label="Vencimiento de autorización de equipos DS 133/1984"
            description="Alerta cuando la autorización de un equipo generador de radiación está próxima a vencer."
            fieldKey="alert_equipment_auth_expiry"
            daysKey="alert_equipment_auth_days_before"
          />
          <ToggleRow
            label="Incidentes radiológicos graves"
            description="Notificación inmediata cuando se registra un incidente de severidad grave."
            fieldKey="alert_incidents_grave"
          />
          <ToggleRow
            label="Requisitos de cumplimiento vencidos"
            description="Alerta cuando un requisito normativo pasa a estado vencido."
            fieldKey="alert_compliance_vencido"
          />
          <ToggleRow
            label="Residuos radiactivos pendientes"
            description="Recordatorio cuando hay registros de residuos sin procesar."
            fieldKey="alert_waste_pending"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar ajustes"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">✓ Ajustes guardados</span>
          )}
        </div>
      </form>
    </div>
  );
}
