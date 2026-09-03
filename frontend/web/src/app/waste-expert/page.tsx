import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";
import { WasteExpertDashboard } from "@/components/waste-expert/waste-expert-dashboard";

export const dynamic = "force-dynamic";

// Fase D - Sistema Experto de Gestion de Desechos Radiactivos: dashboard y
// listado de fichas individuales (Seccion 40 del Prompt Maestro Definitivo).
// No modifica ni reemplaza el modulo anterior en /waste-management.
export default async function WasteExpertPage() {
  await ensureWasteExpertSchema();

const { rows: items } = await sql`
SELECT wi.*, rn.half_life_days, rn.name AS radionuclide_name, rn.symbol AS radionuclide_symbol
FROM waste_items wi
LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
ORDER BY wi.created_at DESC
`;

const { rows: radionuclides } = await sql`
SELECT code, name, symbol, half_life_days FROM radionuclides WHERE active = true ORDER BY sort_order, code
`;

const serializedItems = items.map((row: any) => ({
  ...row,
  fecha_hora_generacion: row.fecha_hora_generacion ? new Date(row.fecha_hora_generacion).toISOString() : null,
  fecha_teorica_cumplimiento: row.fecha_teorica_cumplimiento ? new Date(row.fecha_teorica_cumplimiento).toISOString() : null,
  fecha_verificacion: row.fecha_verificacion ? new Date(row.fecha_verificacion).toISOString() : null,
  fecha_liberacion_autorizada: row.fecha_liberacion_autorizada ? new Date(row.fecha_liberacion_autorizada).toISOString() : null,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
}));

return <WasteExpertDashboard items={serializedItems as any} radionuclides={radionuclides as any} />;
}
