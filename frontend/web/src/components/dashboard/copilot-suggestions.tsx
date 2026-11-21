import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { sql } from "@/lib/db";

interface Suggestion {
  id: string;
  title: string;
  action: string;
  href: string;
  priority: "high" | "normal";
}

async function buildSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // 1. Autorizaciones vencidas
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM workers
      WHERE status <> 'inactive'
        AND authorization_expiry_date IS NOT NULL
        AND authorization_expiry_date < CURRENT_DATE
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-auth-expired",
        title: `Gestionar ${n} autorización${n > 1 ? "es" : ""} vencida${n > 1 ? "s" : ""}`,
        action: "Contactar a CCHEN para renovación. DS 3/1985 Art. 3.",
        href: "/workers",
        priority: "high",
      });
    }
  } catch { /* sin tabla */ }

  // 2. CC MN vencido (sin registro en los últimos 2 días hábiles)
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM qc_records
      WHERE qc_type = 'daily' AND performed_at > NOW() - INTERVAL '48 hours'
    `;
    const n = (rows[0] as { n: number }).n;
    if (n === 0) {
      suggestions.push({
        id: "cop-qc-daily",
        title: "Registrar CC MN diario pendiente",
        action: "No se registra control de calidad diario en las últimas 48h.",
        href: "/quality-control",
        priority: "high",
      });
    }
  } catch { /* sin tabla */ }

  // 3. Incidentes abiertos sin acción asignada
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM incidents
      WHERE status = 'open' AND assigned_to IS NULL
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-incidents-unassigned",
        title: `Asignar responsable a ${n} incidente${n > 1 ? "s" : ""} abierto${n > 1 ? "s" : ""}`,
        action: "Incidentes sin asignar requieren OPR o investigador. NS-06.0 §16.",
        href: "/incidents",
        priority: "high",
      });
    }
  } catch { /* sin tabla */ }

  // 4. Requisitos de cumplimiento críticos pendientes
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM compliance_requirements
      WHERE priority = 'critical' AND status IN ('pending', 'overdue')
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-compliance-critical",
        title: `Resolver ${n} requisito${n > 1 ? "s" : ""} crítico${n > 1 ? "s" : ""} de cumplimiento`,
        action: "Requisitos críticos afectan autorización CCHEN de la instalación.",
        href: "/compliance",
        priority: "high",
      });
    }
  } catch { /* sin tabla */ }

  // 5. Fuentes con inventario vencido
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM radioactive_sources
      WHERE next_inventory_date < CURRENT_DATE AND status = 'in_use'
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-sources-inventory",
        title: `Realizar inventario de ${n} fuente${n > 1 ? "s" : ""} radiactiva${n > 1 ? "s" : ""}`,
        action: "Inventario periódico obligatorio. NS-06.0 §6.",
        href: "/sources",
        priority: "normal",
      });
    }
  } catch { /* sin tabla */ }

  // 6. Radiofármacos próximos a vencer
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM radiopharmaceuticals
      WHERE status = 'active' AND expiry_datetime <= NOW() + INTERVAL '24 hours'
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-rf-expiry",
        title: `${n} radiofármaco${n > 1 ? "s" : ""} próximo${n > 1 ? "s" : ""} a caducar`,
        action: "Verificar disponibilidad para administración o segregar como residuo.",
        href: "/radiopharmacy",
        priority: "normal",
      });
    }
  } catch { /* sin tabla */ }

  // 7. Instrumentos con calibración vencida
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM instruments WHERE status = 'expired'
    `;
    const n = (rows[0] as { n: number }).n;
    if (n > 0) {
      suggestions.push({
        id: "cop-instruments-cal",
        title: `Recalibrar ${n} instrumento${n > 1 ? "s" : ""} de medición`,
        action: "Sin calibración vigente no deben usarse para mediciones oficiales. NS-06.0 §9.",
        href: "/instruments",
        priority: "normal",
      });
    }
  } catch { /* sin tabla */ }

  // Si no hay sugerencias activas, dar una positiva
  if (suggestions.length === 0) {
    suggestions.push({
      id: "cop-allgood",
      title: "Todo al día — sin acciones urgentes",
      action: "El sistema no detecta incumplimientos pendientes en este momento.",
      href: "/compliance",
      priority: "normal",
    });
  }

  // High priority first
  suggestions.sort((a, b) => (a.priority === "high" ? -1 : 1) - (b.priority === "high" ? -1 : 1));
  return suggestions.slice(0, 5);
}

export async function CopilotSuggestions() {
  const suggestions = await buildSuggestions();

  return (
    <div className="flex flex-col gap-2">
      {suggestions.map((s) => (
        <Link
          key={s.id}
          href={s.href}
          className={`group flex items-start gap-2.5 rounded-md border p-2.5 hover:border-accent transition-colors ${
            s.priority === "high"
              ? "border-amber-200 bg-amber-50/40"
              : "border-border bg-surface"
          }`}
        >
          {s.id === "cop-allgood" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2} />
          ) : (
            <Sparkles className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
              s.priority === "high" ? "text-amber-500" : "text-accent"
            }`} strokeWidth={2} />
          )}
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">{s.title}</span>
            <span className="text-[11px] text-muted-foreground">{s.action}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
