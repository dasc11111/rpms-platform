import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables } from "@/lib/linac";
import { ensureQcExtendedTables } from "@/lib/linac-qc";
import { ensureRadiationExtendedTables } from "@/lib/linac-radiation";
import { ensureMaintenanceExtendedTables } from "@/lib/linac-maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
const { searchParams } = new URL(request.url);
const q = (searchParams.get("q") || "").trim();
if (!q || q.length < 2) {
return NextResponse.json({ ok: true, query: q, results: [] });
}

await ensureLinacTables();
await ensureQcExtendedTables();
await ensureRadiationExtendedTables();
await ensureMaintenanceExtendedTables();

const pattern = "%" + q + "%";

const { rows: units } = await sql`
SELECT id, brand, model, manufacturer, serial_number, inventory_number, room
FROM linac_units
WHERE brand ILIKE ${pattern} OR model ILIKE ${pattern} OR manufacturer ILIKE ${pattern}
OR serial_number ILIKE ${pattern} OR inventory_number ILIKE ${pattern} OR room ILIKE ${pattern}
LIMIT 10;
`;

const { rows: documents } = await sql`
SELECT id, linac_id, title, category, file_name, uploaded_at
FROM linac_documents
WHERE is_current = true AND (title ILIKE ${pattern} OR category ILIKE ${pattern} OR file_name ILIKE ${pattern})
LIMIT 10;
`;

const { rows: authorizations } = await sql`
SELECT id, linac_id, doc_type, document_number, file_name, expiry_date
FROM linac_authorizations
WHERE doc_type ILIKE ${pattern} OR document_number ILIKE ${pattern} OR file_name ILIKE ${pattern}
LIMIT 10;
`;

const { rows: qcTests } = await sql`
SELECT id, linac_id, test_name, periodicity, test_date, responsible, instrument_used
FROM linac_qc_tests
WHERE test_name ILIKE ${pattern} OR observations ILIKE ${pattern} OR responsible ILIKE ${pattern}
OR instrument_used ILIKE ${pattern} OR procedure_text ILIKE ${pattern}
LIMIT 10;
`;

const { rows: radiation } = await sql`
SELECT id, linac_id, category, location, measurement_date, responsible, instrument_ref
FROM linac_radiation_protection
WHERE location ILIKE ${pattern} OR notes ILIKE ${pattern} OR responsible ILIKE ${pattern}
OR instrument_ref ILIKE ${pattern} OR category ILIKE ${pattern}
LIMIT 10;
`;

const { rows: maintenance } = await sql`
SELECT id, linac_id, maintenance_type, maintenance_date, company, engineer, spare_parts
FROM linac_maintenance
WHERE company ILIKE ${pattern} OR observations ILIKE ${pattern} OR spare_parts ILIKE ${pattern}
OR engineer ILIKE ${pattern}
LIMIT 10;
`;

const { rows: incidents } = await sql`
SELECT id, linac_id, event, incident_date, description, cause
FROM linac_incidents
WHERE event ILIKE ${pattern} OR description ILIKE ${pattern} OR cause ILIKE ${pattern}
OR investigation ILIKE ${pattern}
LIMIT 10;
`;

const { rows: risks } = await sql`
SELECT id, linac_id, risk, responsible, mitigation, risk_level
FROM linac_risks
WHERE risk ILIKE ${pattern} OR responsible ILIKE ${pattern} OR mitigation ILIKE ${pattern}
LIMIT 10;
`;

const results = [
...units.map((r: any) => ({ type: "Equipo", tab: "info", id: r.id, linacId: r.id, label: [r.brand, r.model].filter(Boolean).join(" ") || "Equipo", subtitle: [r.manufacturer, r.serial_number, r.room].filter(Boolean).join(" · ") })),
...documents.map((r: any) => ({ type: "Documento", tab: "documents", id: r.id, linacId: r.linac_id, label: r.title || r.file_name || "Documento", subtitle: [r.category, r.file_name].filter(Boolean).join(" · "), date: r.uploaded_at })),
...authorizations.map((r: any) => ({ type: "Autorizacion", tab: "auth", id: r.id, linacId: r.linac_id, label: r.doc_type, subtitle: [r.document_number, r.file_name].filter(Boolean).join(" · "), date: r.expiry_date })),
...qcTests.map((r: any) => ({ type: "Control de Calidad", tab: "qc", id: r.id, linacId: r.linac_id, label: r.test_name, subtitle: [r.periodicity, r.responsible, r.instrument_used].filter(Boolean).join(" · "), date: r.test_date })),
...radiation.map((r: any) => ({ type: "Proteccion Radiologica", tab: "radiation", id: r.id, linacId: r.linac_id, label: r.category || "Registro", subtitle: [r.location, r.responsible, r.instrument_ref].filter(Boolean).join(" · "), date: r.measurement_date })),
...maintenance.map((r: any) => ({ type: "Mantenimiento", tab: "maintenance", id: r.id, linacId: r.linac_id, label: [r.maintenance_type, r.company].filter(Boolean).join(" - "), subtitle: [r.engineer, r.spare_parts].filter(Boolean).join(" · "), date: r.maintenance_date })),
...incidents.map((r: any) => ({ type: "Incidente", tab: "incidents", id: r.id, linacId: r.linac_id, label: r.event, subtitle: (r.description || "").slice(0, 80), date: r.incident_date })),
...risks.map((r: any) => ({ type: "Riesgo", tab: "risks", id: r.id, linacId: r.linac_id, label: r.risk, subtitle: [r.responsible, "Nivel " + (r.risk_level ?? "-")].filter(Boolean).join(" · ") })),
];

return NextResponse.json({ ok: true, query: q, results, total: results.length });
}
