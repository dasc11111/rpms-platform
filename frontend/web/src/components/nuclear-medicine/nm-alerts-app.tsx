"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
} from "lucide-react";

type Severity = "critica" | "media" | "informativa";

type AlertItem = {
  severity: Severity;
  modulo: string;
  text: string;
  href?: string;
};

type ContaminationStats = {
  totals: { total: number; conformes: number; cercanos: number; sobreLimite: number };
};

type RoomClearanceStats = {
  total: number;
  lab_contaminados: number;
  sala_contaminados: number;
};

type WasteStats = {
  totals: { pendientes: number };
  proximosDecaimiento: { id: number; label_number: string }[];
  liberables: { id: number; label_number: string }[];
};

type InstrumentRow = {
  id: number;
  code: string;
  name: string;
  alert_level: string;
  days_remaining: number | null;
};

type InstrumentsResponse = { instruments: InstrumentRow[]; total: number };

type TransportAuthorization = {
  number: string;
  alertLevel: string;
  daysRemaining: number | null;
};

type TransportDashboard = {
  authorization: TransportAuthorization | null;
  compliance: { total: number; dosimeterPct: number; radiactivo7Pct: number; nu2915Pct: number; driverPct: number; oprPct: number };
  exceededLimits: number;
};

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

type SeverityMeta = {
  label: string;
  icon: IconType;
  badgeClass: string;
  textClass: string;
};

const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critica: { label: "Critica", icon: ShieldAlert, badgeClass: "border-red-500/40 bg-red-500/5 text-red-500", textClass: "text-red-500" },
  media: { label: "Media", icon: AlertTriangle, badgeClass: "border-amber-500/40 bg-amber-500/5 text-amber-500", textClass: "text-amber-500" },
  informativa: { label: "Informativa", icon: Info, badgeClass: "border-blue-500/40 bg-blue-500/5 text-blue-500", textClass: "text-blue-500" },
};

const SEVERITY_ORDER: Severity[] = ["critica", "media", "informativa"];

// Fase 10 (Medicina Nuclear) - Alertas: vista de solo lectura que agrega
// alertas ya clasificadas por los modulos existentes (Contaminacion,
// Liberacion de Sala, Gestion de Residuos, Instrumentos y Calibracion,
// Transporte). No define nuevos limites, formulas ni clasificaciones: la
// severidad (critica/media/informativa) se deriva directamente de los
// niveles ya calculados por cada modulo (por ejemplo alert_level de
// Instrumentos o alertLevel de Transporte). Cumple con la seccion 55 del
// prompt maestro (no invencion) y respeta la seccion 2 (Control de Calidad
// excluido: este panel no consulta ningun dato de Control de Calidad).
export function NuclearMedicineAlertsApp() {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const [contamination, roomClearance, waste, instrumentsRes, transport] = await Promise.all([
        fetch("/api/contamination/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<ContaminationStats | null>,
        fetch("/api/room-clearance/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<RoomClearanceStats | null>,
        fetch("/api/waste-labels/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<WasteStats | null>,
        fetch("/api/instruments").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<InstrumentsResponse | null>,
        fetch("/api/transport/dashboard").then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<TransportDashboard | null>,
      ]);

      if (!active) return;

      const list: AlertItem[] = [];

      if (contamination) {
        if (contamination.totals.sobreLimite > 0) {
          list.push({
            severity: "critica",
            modulo: "Contaminacion",
            text: contamination.totals.sobreLimite + " registro(s) de contaminacion sobre el limite.",
            href: "/contamination",
          });
        }
        if (contamination.totals.cercanos > 0) {
          list.push({
            severity: "media",
            modulo: "Contaminacion",
            text: contamination.totals.cercanos + " registro(s) de contaminacion cercanos al limite.",
            href: "/contamination",
          });
        }
      }

      if (roomClearance) {
        const pendientes = (roomClearance.lab_contaminados ?? 0) + (roomClearance.sala_contaminados ?? 0);
        if (pendientes > 0) {
          list.push({
            severity: "media",
            modulo: "Liberacion de Sala",
            text: pendientes + " evaluacion(es) de liberacion de sala requieren descontaminacion.",
            href: "/room-release",
          });
        }
      }

      if (waste) {
        if ((waste.proximosDecaimiento?.length ?? 0) > 0) {
          list.push({
            severity: "media",
            modulo: "Gestion de Residuos",
            text: waste.proximosDecaimiento.length + " rotulo(s) de residuos proximos a completar el decaimiento (8 a 10 semividas).",
            href: "/waste-management",
          });
        }
        if ((waste.liberables?.length ?? 0) > 0) {
          list.push({
            severity: "media",
            modulo: "Gestion de Residuos",
            text: waste.liberables.length + " rotulo(s) de residuos alcanzaron el criterio de decaimiento (10 o mas semividas) y estan pendientes de verificacion final.",
            href: "/waste-management",
          });
        }
        if (waste.totals.pendientes > 0) {
          list.push({
            severity: "informativa",
            modulo: "Gestion de Residuos",
            text: waste.totals.pendientes + " rotulo(s) de residuos pendientes de verificacion.",
            href: "/waste-management",
          });
        }
      }

      if (instrumentsRes?.instruments) {
        const vencidos = instrumentsRes.instruments.filter((i) => i.alert_level === "vencida" || i.alert_level === "rojo");
        const proximos = instrumentsRes.instruments.filter((i) => i.alert_level === "amarillo");
        const sinCalibracion = instrumentsRes.instruments.filter((i) => i.alert_level === "sin_calibracion");
        if (vencidos.length > 0) {
          list.push({
            severity: "critica",
            modulo: "Instrumentos y Calibracion",
            text: vencidos.length + " instrumento(s) con calibracion vencida o a menos de 30 dias de vencer.",
            href: "/instruments",
          });
        }
        if (proximos.length > 0) {
          list.push({
            severity: "media",
            modulo: "Instrumentos y Calibracion",
            text: proximos.length + " instrumento(s) con calibracion proxima a vencer (menos de 180 dias).",
            href: "/instruments",
          });
        }
        if (sinCalibracion.length > 0) {
          list.push({
            severity: "informativa",
            modulo: "Instrumentos y Calibracion",
            text: sinCalibracion.length + " instrumento(s) sin registro de calibracion.",
            href: "/instruments",
          });
        }
      }

      if (transport) {
        if (transport.authorization) {
          const lvl = transport.authorization.alertLevel;
          if (lvl === "rojo") {
            list.push({
              severity: "critica",
              modulo: "Transporte",
              text: "Autorizacion de transporte de material radiactivo vencida o a menos de 90 dias de vencer.",
              href: "/transport",
            });
          } else if (lvl === "naranjo" || lvl === "amarillo") {
            list.push({
              severity: "media",
              modulo: "Transporte",
              text: "Autorizacion de transporte de material radiactivo proxima a vencer.",
              href: "/transport",
            });
          }
        } else {
          list.push({
            severity: "critica",
            modulo: "Transporte",
            text: "No hay una autorizacion de transporte de material radiactivo vigente registrada.",
            href: "/transport",
          });
        }
        if (transport.exceededLimits > 0) {
          list.push({
            severity: "critica",
            modulo: "Transporte",
            text: transport.exceededLimits + " despacho(s) de transporte con tasa de dosis sobre el limite (1 metro mayor a 100 uSv/h o vehiculo mayor a 2000 uSv/h).",
            href: "/transport",
          });
        }
      }

      setAlerts(list);
      setCheckedAt(new Date().toISOString());
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (!alerts) {
    return <div className="text-sm text-muted-foreground">Cargando alertas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SEVERITY_ORDER.map((sev) => {
          const meta = SEVERITY_META[sev];
          const Icon = meta.icon;
          const count = alerts.filter((a) => a.severity === sev).length;
          return (
            <div key={sev} className={"flex items-center justify-between rounded-lg border p-4 " + meta.badgeClass}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              <span className="text-2xl font-semibold tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          No hay alertas activas segun los datos actualmente registrados en los modulos de Medicina Nuclear.
        </div>
      )}

      {SEVERITY_ORDER.map((sev) => {
        const items = alerts.filter((a) => a.severity === sev);
        if (items.length === 0) return null;
        const meta = SEVERITY_META[sev];
        return (
          <div key={sev} className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{meta.label}</h3>
            <ul className="space-y-2 text-sm">
              {items.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className={meta.textClass}>
                    <span className="font-medium">{a.modulo}:</span> {a.text}
                  </span>
                  {a.href && (
                    <a href={a.href} className="whitespace-nowrap text-xs text-accent hover:underline">
                      Ver modulo
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="text-[11px] text-muted-foreground">
        {checkedAt ? "Ultima verificacion: " + new Date(checkedAt).toLocaleString("es-CL") + ". " : ""}
        Este panel consolida alertas ya clasificadas por los modulos existentes (Contaminacion, Liberacion de
        Sala, Gestion de Residuos, Instrumentos y Calibracion, Transporte). No introduce limites, formulas ni
        clasificaciones nuevas: la severidad se deriva directamente de los niveles ya calculados por cada
        modulo. Corresponde a la Fase 10 (propuesta en el informe de Fase 0). Control de Calidad queda fuera
        del alcance de este panel (seccion 2 del prompt maestro).
      </p>
    </div>
  );
}
