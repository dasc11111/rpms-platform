"use client";

import { useEffect, useState } from "react";
import {
  Syringe,
  Biohazard,
  DoorOpen,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  Users,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { mesNombre } from "@/lib/i131";

type I131Stats = {
  totals: {
    total: number;
    month: number;
    year: number;
    patients: number;
  };
  tendenciaMensual: { year: number; month: number; count: number }[];
};

type ContaminationStats = {
  totals: {
    total: number;
    conformes: number;
    cercanos: number;
    sobreLimite: number;
  };
  porClasificacion: { clasificacion: string; count: number }[];
};

type RoomClearanceStats = {
  total: number;
  mes: number;
  lab_liberados: number;
  sala_liberados: number;
  lab_contaminados: number;
  sala_contaminados: number;
  descontaminaciones: number;
};

type WasteStats = {
  totals: {
    total: number;
    almacenados: number;
    liberados: number;
    pendientes: number;
  };
};

const CLASIFICACION_LABELS: Record<string, string> = {
  sin_contaminacion: "Sin contaminacion",
  bajo_referencia: "Bajo nivel de referencia",
  cercano_limite: "Cercano al limite",
  sobre_limite: "Sobre el limite",
};

const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626"];

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "danger"
      ? "border-red-500/40 bg-red-500/5"
      : "border-border bg-surface";
  return (
    <div className={`flex flex-col justify-between rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

// Dashboard de solo lectura: agrega indicadores ya calculados por los
// endpoints existentes de cada modulo (I-131, Contaminacion, Liberacion de
// Sala, Residuos Radiactivos). No agrega calculos nuevos, no crea columnas
// nuevas en la base de datos y no modifica ningun registro. Corresponde a
// la "Fase 8 (propuesta)" del informe de Fase 0.
export function NuclearMedicineDashboard() {
  const [i131, setI131] = useState<I131Stats | null>(null);
  const [contamination, setContamination] = useState<ContaminationStats | null>(null);
  const [roomClearance, setRoomClearance] = useState<RoomClearanceStats | null>(null);
  const [waste, setWaste] = useState<WasteStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/i131/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/contamination/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/room-clearance/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/waste-labels/stats").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([i, c, r, w]) => {
      if (!active) return;
      setI131(i);
      setContamination(c);
      setRoomClearance(r);
      setWaste(w);
      if (!i && !c && !r && !w) setLoadError(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const loading = !i131 && !contamination && !roomClearance && !waste && !loadError;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Cargando indicadores...</div>;
  }

  const tendencia = (i131?.tendenciaMensual ?? []).map((r) => ({
    label: `${mesNombre(r.month).slice(0, 3)} ${String(r.year).slice(2)}`,
    count: r.count,
  }));

  const clasificacionData = (contamination?.porClasificacion ?? []).map((r) => ({
    name: CLASIFICACION_LABELS[r.clasificacion] ?? r.clasificacion,
    value: r.count,
  }));

  const residuosData = waste
    ? [
        { name: "Almacenados", value: waste.totals.almacenados },
        { name: "Liberados", value: waste.totals.liberados },
        { name: "Pendientes", value: waste.totals.pendientes },
      ]
    : [];

  const alertas: { level: "danger" | "warning" | "info"; text: string }[] = [];
  if (contamination && contamination.totals.sobreLimite > 0) {
    alertas.push({
      level: "danger",
      text: `${contamination.totals.sobreLimite} registro(s) de contaminacion sobre el limite.`,
    });
  }
  if (contamination && contamination.totals.cercanos > 0) {
    alertas.push({
      level: "warning",
      text: `${contamination.totals.cercanos} registro(s) de contaminacion cercanos al limite.`,
    });
  }
  if (roomClearance && roomClearance.lab_contaminados + roomClearance.sala_contaminados > 0) {
    alertas.push({
      level: "warning",
      text: `${roomClearance.lab_contaminados + roomClearance.sala_contaminados} evaluacion(es) de liberacion de sala requieren descontaminacion.`,
    });
  }
  if (waste && waste.totals.pendientes > 0) {
    alertas.push({
      level: "info",
      text: `${waste.totals.pendientes} rotulo(s) de residuos pendientes de verificacion final.`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Administraciones I-131 (mes)" value={i131?.totals.month ?? "-"} icon={Syringe} />
        <StatCard label="Pacientes trazados" value={i131?.totals.patients ?? "-"} icon={Users} />
        <StatCard label="Contaminacion: conformes" value={contamination?.totals.conformes ?? "-"} icon={CheckCircle2} />
        <StatCard
          label="Contaminacion: sobre limite"
          value={contamination?.totals.sobreLimite ?? "-"}
          icon={Biohazard}
          tone={contamination && contamination.totals.sobreLimite > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Salas liberadas (lab+sala)"
          value={roomClearance ? roomClearance.lab_liberados + roomClearance.sala_liberados : "-"}
          icon={DoorOpen}
        />
        <StatCard label="Residuos almacenados" value={waste?.totals.almacenados ?? "-"} icon={Recycle} />
        <StatCard label="Residuos liberados" value={waste?.totals.liberados ?? "-"} icon={Layers} />
        <StatCard
          label="Residuos pendientes"
          value={waste?.totals.pendientes ?? "-"}
          icon={AlertTriangle}
          tone={waste && waste.totals.pendientes > 0 ? "warning" : "default"}
        />
      </div>

      {alertas.length > 0 && (
        <SectionCard title="Alertas operativas (basadas en datos ya registrados)">
          <ul className="space-y-1.5 text-sm">
            {alertas.map((a, i) => (
              <li
                key={i}
                className={
                  a.level === "danger"
                    ? "text-red-500"
                    : a.level === "warning"
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }
              >
                {a.text}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Tendencia mensual de administraciones I-131">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} name="Administraciones" />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Contaminacion por clasificacion">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={clasificacionData} dataKey="value" nameKey="name" outerRadius={80} label>
                {clasificacionData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Residuos radiactivos por estado">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={residuosData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0891b2" name="Rotulos" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Liberacion de sala (acumulado)">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Evaluaciones totales</span>
              <span className="font-medium tabular-nums">{roomClearance?.total ?? "-"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Este mes</span>
              <span className="font-medium tabular-nums">{roomClearance?.mes ?? "-"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Laboratorio liberado</span>
              <span className="font-medium tabular-nums">{roomClearance?.lab_liberados ?? "-"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Sala liberada</span>
              <span className="font-medium tabular-nums">{roomClearance?.sala_liberados ?? "-"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Descontaminaciones requeridas</span>
              <span className="font-medium tabular-nums">{roomClearance?.descontaminaciones ?? "-"}</span>
            </li>
          </ul>
        </SectionCard>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Este panel consolida indicadores ya calculados por los modulos existentes (I-131,
        Contaminacion, Liberacion de Sala y Gestion de Residuos). No introduce calculos, limites
        ni campos nuevos: es una vista de solo lectura, conforme al diseno de la Fase 0
        (auditoria) usando ARPANSA RPS 14.2 como referencia tecnica estructural.
      </p>
    </div>
  );
}
