/**
 * I-131 Patient Isolation Tracking
 * DS 3/1985 MINSAL - Criterios de aislamiento para I-131 (radioiodo)
 *
 * Criterio de alta (el que se cumpla primero):
 *   - Tasa de dosis a 1 m < 25 μSv/h, O
 *   - Actividad remanente < 1.11 GBq (≈ 30 mCi)
 *
 * Vida media física I-131: 8.02 días
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const I131_HALF_LIFE_DAYS = 8.02;
// Alta por actividad: 30 mCi = 1.11 GBq
const I131_RELEASE_THRESHOLD_MCI = 30;
// Alta por tasa de dosis: 25 μSv/h a 1m
const I131_RELEASE_DOSE_RATE_USV_H = 25;
// Ventana máxima de seguimiento: 30 días post-administración
const MAX_DAYS_TRACKING = 30;

interface I131IsolationRecord {
  id: number;
  admin_date: string;
  paciente_nombre: string;
  paciente_run: string | null;
  ficha_clinica: string | null;
  sala: string | null;
  dosis_administrada: number | null; // mCi
  tasa_dosis: string | null; // texto libre, e.g. "5 μSv/h"
  medico_solicitante: string | null;
  diagnostico: string | null;
  // Computed
  days_since_admin: number;
  remaining_activity_mci: number | null;
  estimated_release_date: string | null;
  days_to_release: number | null;
  isolation_status: "en_aislamiento" | "apto_alta" | "vencido";
  can_release_by_activity: boolean;
  release_threshold_mci: number;
}

function calcRemainingActivity(dosis_mci: number, days: number): number {
  return dosis_mci * Math.pow(2, -days / I131_HALF_LIFE_DAYS);
}

function calcDaysToReleaseByActivity(dosis_mci: number): number {
  if (dosis_mci <= I131_RELEASE_THRESHOLD_MCI) return 0;
  return I131_HALF_LIFE_DAYS * Math.log2(dosis_mci / I131_RELEASE_THRESHOLD_MCI);
}

export async function GET() {
  try {
    // Get all I-131 administrations from the last 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_TRACKING);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    // Ensure main i131 table exists (lazy init) — misma tabla que usa el módulo
    // principal de I-131 (/api/i131/route.ts); el módulo de aislamiento es una
    // vista de solo lectura sobre los mismos datos. NO se crea una tabla separada.
    await sql`
      CREATE TABLE IF NOT EXISTS i131_administrations (
        id SERIAL PRIMARY KEY,
        admin_year INT,
        admin_month INT,
        admin_day INT,
        admin_date DATE,
        paciente_nombre TEXT,
        paciente_run TEXT,
        ficha_clinica TEXT,
        sala TEXT,
        dosis_administrada NUMERIC,
        tasa_dosis TEXT,
        medico_solicitante TEXT,
        diagnostico TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    const rows = await sql`
      SELECT
        id, admin_date, paciente_nombre, paciente_run, ficha_clinica,
        sala, dosis_administrada, tasa_dosis, medico_solicitante, diagnostico
      FROM i131_administrations
      WHERE admin_date >= ${cutoffStr}
        AND dosis_administrada IS NOT NULL
        AND dosis_administrada > 0
      ORDER BY admin_date DESC
    `;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: I131IsolationRecord[] = (rows as any[]).map((row) => {
      const adminDate = new Date(row.admin_date);
      adminDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - adminDate.getTime()) / (1000 * 60 * 60 * 24));

      const dosis = Number(row.dosis_administrada);
      const remainingActivity = calcRemainingActivity(dosis, daysSince);
      const canReleaseByActivity = remainingActivity <= I131_RELEASE_THRESHOLD_MCI;

      const daysToReleaseByActivity = calcDaysToReleaseByActivity(dosis);
      const daysRemaining = Math.max(0, Math.ceil(daysToReleaseByActivity - daysSince));

      // Estimated release date (by activity criterion)
      const releaseDate = new Date(adminDate);
      releaseDate.setDate(releaseDate.getDate() + Math.ceil(daysToReleaseByActivity));
      const estimatedReleaseDate = releaseDate.toISOString().slice(0, 10);

      let isolationStatus: I131IsolationRecord["isolation_status"];
      if (daysSince > MAX_DAYS_TRACKING) {
        isolationStatus = "vencido";
      } else if (canReleaseByActivity) {
        isolationStatus = "apto_alta";
      } else {
        isolationStatus = "en_aislamiento";
      }

      return {
        id: row.id,
        admin_date: row.admin_date,
        paciente_nombre: row.paciente_nombre,
        paciente_run: row.paciente_run,
        ficha_clinica: row.ficha_clinica,
        sala: row.sala,
        dosis_administrada: dosis,
        tasa_dosis: row.tasa_dosis,
        medico_solicitante: row.medico_solicitante,
        diagnostico: row.diagnostico,
        days_since_admin: daysSince,
        remaining_activity_mci: Math.round(remainingActivity * 10) / 10,
        estimated_release_date: estimatedReleaseDate,
        days_to_release: daysRemaining,
        isolation_status: isolationStatus,
        can_release_by_activity: canReleaseByActivity,
        release_threshold_mci: I131_RELEASE_THRESHOLD_MCI,
      };
    });

    const stats = {
      en_aislamiento: results.filter((r) => r.isolation_status === "en_aislamiento").length,
      apto_alta: results.filter((r) => r.isolation_status === "apto_alta").length,
      total_tracked: results.length,
      release_threshold_mci: I131_RELEASE_THRESHOLD_MCI,
      release_threshold_gbq: (I131_RELEASE_THRESHOLD_MCI * 37) / 1000, // 1.11 GBq
      release_dose_rate_usv_h: I131_RELEASE_DOSE_RATE_USV_H,
    };

    return NextResponse.json({ data: results, stats });
  } catch (err) {
    console.error("GET /api/i131/isolation", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
