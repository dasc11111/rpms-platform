import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");

  const bunkersRes = await sql`SELECT COUNT(*)::int AS count FROM rt_bunkers WHERE facility_id = ${facilityId}`;
  const devicesRes = await sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'operativo')::int AS operational
    FROM rt_safety_devices
    WHERE bunker_id IN (SELECT id FROM rt_bunkers WHERE facility_id = ${facilityId})
  `;
  const incidentsOpenRes = await sql`SELECT COUNT(*)::int AS count FROM rt_incidents WHERE facility_id = ${facilityId} AND status = 'abierto'`;
  const nearMissRes = await sql`SELECT COUNT(*)::int AS count FROM rt_incidents WHERE facility_id = ${facilityId} AND is_near_miss = true`;
  const auditsOpenRes = await sql`SELECT COUNT(*)::int AS count FROM rt_audits WHERE facility_id = ${facilityId} AND status = 'abierta'`;
  const trainingExpiringRes = await sql`
    SELECT COUNT(*)::int AS count FROM rt_trainings
    WHERE facility_id = ${facilityId} AND expiry_date IS NOT NULL AND expiry_date < (now() + interval '60 days')
  `;
  const incidentsBySeverityRes = await sql`
    SELECT severity, COUNT(*)::int AS count FROM rt_incidents WHERE facility_id = ${facilityId} GROUP BY severity
  `;
  const recentSurveysRes = await sql`
    SELECT * FROM rt_radiation_surveys
    WHERE bunker_id IN (SELECT id FROM rt_bunkers WHERE facility_id = ${facilityId})
    ORDER BY survey_date DESC LIMIT 10
  `;

  return NextResponse.json({
    ok: true,
    kpis: {
      bunkers: bunkersRes.rows[0]?.count || 0,
      devicesTotal: devicesRes.rows[0]?.total || 0,
      devicesOperational: devicesRes.rows[0]?.operational || 0,
      incidentsOpen: incidentsOpenRes.rows[0]?.count || 0,
      nearMiss: nearMissRes.rows[0]?.count || 0,
      auditsOpen: auditsOpenRes.rows[0]?.count || 0,
      trainingExpiring: trainingExpiringRes.rows[0]?.count || 0,
    },
    incidentsBySeverity: incidentsBySeverityRes.rows,
    recentSurveys: recentSurveysRes.rows,
  });
}
