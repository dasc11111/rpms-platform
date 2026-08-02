import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables, getAuthAlertLevel } from "@/lib/transport";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  await ensureTransportTables();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = today.toISOString().slice(0, 7) + "-01";
  const yearStart = today.toISOString().slice(0, 4) + "-01-01";

  const [
    totalsRes,
    todayRes,
    monthRes,
    yearRes,
    materialRes,
    doseAvgRes,
    exceededRes,
    complianceRes,
    generatorRes,
    i131Res,
    monthlyTrendRes,
    yearlyTrendRes,
    authRes,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS total FROM transport_shipments;`,
    sql`SELECT COUNT(*) AS total FROM transport_shipments WHERE transport_date = ${todayStr};`,
    sql`SELECT COUNT(*) AS total FROM transport_shipments WHERE transport_date >= ${monthStart};`,
    sql`SELECT COUNT(*) AS total FROM transport_shipments WHERE transport_date >= ${yearStart};`,
    sql`SELECT material_code, COUNT(*) AS total FROM transport_shipments GROUP BY material_code;`,
    sql`SELECT AVG(it_value) AS avg_it, AVG(dose_contact) AS avg_contact, AVG(dose_1m) AS avg_1m, AVG(dose_vehicle) AS avg_vehicle FROM transport_shipments;`,
    sql`SELECT COUNT(*) AS total FROM transport_shipments WHERE dose_1m > 100 OR dose_vehicle > 2000;`,
    sql`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN signage_dosimeter THEN 1 ELSE 0 END) AS with_dosimeter,
        SUM(CASE WHEN signage_radiactivo7 THEN 1 ELSE 0 END) AS with_radiactivo7,
        SUM(CASE WHEN signage_nu2915 THEN 1 ELSE 0 END) AS with_nu2915,
        SUM(CASE WHEN driver_name IS NOT NULL THEN 1 ELSE 0 END) AS with_driver,
        SUM(CASE WHEN opr_name IS NOT NULL THEN 1 ELSE 0 END) AS with_opr
      FROM transport_shipments;
    `,
    sql`
      SELECT COUNT(*) AS total, SUM(requested_activity_mci) AS total_activity,
        AVG(requested_activity_mci) AS avg_activity, MAX(requested_activity_mci) AS max_activity,
        MIN(requested_activity_mci) AS min_activity
      FROM transport_shipments WHERE material_code = 'MO_TC99';
    `,
    sql`
      SELECT
        COUNT(DISTINCT s.id) AS total_shipments,
        COUNT(a.id) AS total_capsules,
        SUM(a.activity_mci) AS total_activity,
        AVG(a.activity_mci) AS avg_activity,
        MAX(a.activity_mci) AS max_activity,
        MIN(a.activity_mci) AS min_activity
      FROM transport_shipments s
      JOIN transport_i131_activities a ON a.shipment_id = s.id
      WHERE s.material_code = 'I131';
    `,
    sql`
      SELECT to_char(transport_date, 'YYYY-MM') AS ym, COUNT(*) AS total
      FROM transport_shipments
      WHERE transport_date >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY ym ORDER BY ym;
    `,
    sql`
      SELECT EXTRACT(YEAR FROM transport_date)::int AS yr, COUNT(*) AS total
      FROM transport_shipments
      GROUP BY yr ORDER BY yr;
    `,
    sql`SELECT * FROM transport_authorization_documents WHERE is_current = true ORDER BY version DESC LIMIT 1;`,
  ]);

  const materialCounts: Record<string, number> = {};
  for (const r of materialRes.rows as any[]) materialCounts[r.material_code] = num(r.total);

  const compliance = complianceRes.rows[0] as any;
  const totalShip = num(compliance?.total);
  const pct = (v: unknown) => (totalShip > 0 ? Math.round((num(v) / totalShip) * 1000) / 10 : 0);

  const auth = authRes.rows[0] as any;
  let authInfo = null;
  if (auth) {
    const expiry = auth.expiry_date ? new Date(auth.expiry_date) : null;
    const daysRemaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
    authInfo = {
      number: auth.number,
      issuedDate: auth.issued_date,
      expiryDate: auth.expiry_date,
      daysRemaining,
      alertLevel: getAuthAlertLevel(daysRemaining),
    };
  }

  const doseAvg = doseAvgRes.rows[0] as any;
  const generator = generatorRes.rows[0] as any;
  const i131 = i131Res.rows[0] as any;

  return NextResponse.json({
    ok: true,
    totalTransports: num(totalsRes.rows[0]?.total),
    transportsToday: num(todayRes.rows[0]?.total),
    transportsThisMonth: num(monthRes.rows[0]?.total),
    transportsThisYear: num(yearRes.rows[0]?.total),
    materialCounts,
    averages: {
      it: num(doseAvg?.avg_it),
      doseContact: num(doseAvg?.avg_contact),
      dose1m: num(doseAvg?.avg_1m),
      doseVehicle: num(doseAvg?.avg_vehicle),
    },
    exceededLimits: num(exceededRes.rows[0]?.total),
    compliance: {
      total: totalShip,
      dosimeterPct: pct(compliance?.with_dosimeter),
      radiactivo7Pct: pct(compliance?.with_radiactivo7),
      nu2915Pct: pct(compliance?.with_nu2915),
      driverPct: pct(compliance?.with_driver),
      oprPct: pct(compliance?.with_opr),
    },
    generatorStats: {
      total: num(generator?.total),
      totalActivityMci: num(generator?.total_activity),
      avgActivityMci: num(generator?.avg_activity),
      maxActivityMci: num(generator?.max_activity),
      minActivityMci: num(generator?.min_activity),
    },
    i131Stats: {
      totalShipments: num(i131?.total_shipments),
      totalCapsules: num(i131?.total_capsules),
      totalActivityMci: num(i131?.total_activity),
      avgActivityMci: num(i131?.avg_activity),
      maxActivityMci: num(i131?.max_activity),
      minActivityMci: num(i131?.min_activity),
    },
    monthlyTrend: (monthlyTrendRes.rows as any[]).map((r) => ({ month: r.ym, total: num(r.total) })),
    yearlyTrend: (yearlyTrendRes.rows as any[]).map((r) => ({ year: r.yr, total: num(r.total) })),
    authorization: authInfo,
  });
}
