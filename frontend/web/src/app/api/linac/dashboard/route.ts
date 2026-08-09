import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, computeVigencyLevel } from "@/lib/linac";
import { ensureQcExtendedTables } from "@/lib/linac-qc";

export const dynamic = "force-dynamic";

export async function GET() {
await ensureLinacTables();
await ensureQcExtendedTables();

const { rows: units } = await sql`SELECT id, brand, model, room, operational_status FROM linac_units ORDER BY id ASC`;

const { rows: monthlyOps } = await sql`
SELECT to_char(op_date, 'YYYY-MM') AS month,
SUM(patients_treated) AS patients,
SUM(operating_hours) AS operating_hours,
SUM(downtime_hours) AS downtime_hours
FROM linac_clinical_operations
WHERE op_date >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY month ORDER BY month ASC;
`;

const { rows: treatmentTypes } = await sql`
SELECT treatment_type, COUNT(*) AS count
FROM linac_clinical_operations
WHERE treatment_type IS NOT NULL
GROUP BY treatment_type ORDER BY count DESC;
`;

const { rows: qcStats } = await sql`
SELECT periodicity,
COUNT(*) AS total,
COUNT(*) FILTER (WHERE status = 'cumple') AS ok_count
FROM linac_qc_tests
GROUP BY periodicity;
`;

const { rows: qcSemaphore } = await sql`
SELECT semaphore, COUNT(*) AS count
FROM linac_qc_tests
GROUP BY semaphore;
`;

const { rows: qcAlerts } = await sql`
SELECT * FROM linac_qc_alerts
WHERE status = 'abierta'
ORDER BY created_at DESC
LIMIT 20;
`;

const { rows: authRows } = await sql`SELECT * FROM linac_authorizations WHERE is_current = true`;
const authorizations = authRows.map((r) => ({ ...r, vigencyLevel: computeVigencyLevel(r.expiry_date) }));

const { rows: incidentStats } = await sql`
SELECT status, COUNT(*) AS count FROM linac_incidents GROUP BY status;
`;

const { rows: maintenanceStats } = await sql`
SELECT maintenance_type, COUNT(*) AS count, COALESCE(SUM(hours), 0) AS total_hours, COALESCE(SUM(cost), 0) AS total_cost
FROM linac_maintenance GROUP BY maintenance_type;
`;

const { rows: riskRows } = await sql`SELECT risk, risk_level, responsible FROM linac_risks ORDER BY risk_level DESC NULLS LAST LIMIT 10`;

const { rows: totals } = await sql`
SELECT
(SELECT COUNT(*) FROM linac_qc_tests) AS qc_total,
(SELECT COUNT(*) FROM linac_qc_tests WHERE status = 'cumple') AS qc_ok,
(SELECT COUNT(*) FROM linac_qc_alerts WHERE status = 'abierta') AS qc_alerts_open,
(SELECT COUNT(*) FROM linac_incidents WHERE status = 'abierto') AS incidents_open,
(SELECT COUNT(*) FROM linac_documents WHERE is_current = true) AS documents_total,
(SELECT COALESCE(SUM(operating_hours), 0) FROM linac_clinical_operations) AS total_operating_hours,
(SELECT COALESCE(SUM(downtime_hours), 0) FROM linac_clinical_operations) AS total_downtime_hours,
(SELECT COALESCE(SUM(patients_treated), 0) FROM linac_clinical_operations) AS total_patients;
`;

const t = totals[0] || {};
const operatingHours = Number(t.total_operating_hours || 0);
const downtimeHours = Number(t.total_downtime_hours || 0);
const availability = operatingHours + downtimeHours > 0
? Math.round((operatingHours / (operatingHours + downtimeHours)) * 1000) / 10
: 100;
const qcCompliance = Number(t.qc_total || 0) > 0
? Math.round((Number(t.qc_ok || 0) / Number(t.qc_total)) * 1000) / 10
: 100;

return NextResponse.json({
ok: true,
units,
kpis: {
availability,
qcCompliance,
qcAlertsOpen: Number(t.qc_alerts_open || 0),
incidentsOpen: Number(t.incidents_open || 0),
documentsTotal: Number(t.documents_total || 0),
totalPatients: Number(t.total_patients || 0),
totalOperatingHours: operatingHours,
totalDowntimeHours: downtimeHours,
},
monthlyOps,
treatmentTypes,
qcStats,
qcSemaphore,
qcAlerts,
authorizations,
incidentStats,
maintenanceStats,
topRisks: riskRows,
});
}
