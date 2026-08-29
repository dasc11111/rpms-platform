import { sql } from "@/lib/db";
import { ensureActivimetroArchitectureTables, recordActivimetroAuditLog } from "@/lib/qc-activimetro-architecture-db";

/**
 * MODULO ACTIVIMETRO - ACTIV-01: INSPECCION FISICA Y FUNCIONAL
 * (seccion 6 del prompt maestro QA/QC Activimetros)
 *
 * Checklist de verificacion fisica/funcional del equipo, independiente de
 * las pruebas cuantitativas del modulo basico (qc-activimetro-db.ts).
 * El listado de items es CATALOGO (datos), no codigo: se almacena en
 * qc_activimetro_inspection_checklist y puede ampliarse sin tocar el motor.
 *
 * Cada inspeccion (qc_activimetro_inspections) guarda un snapshot de las
 * etiquetas de cada item en el momento de la inspeccion
 * (qc_activimetro_inspection_items), para que cambios futuros en el
 * catalogo no reescriban el historial.
 *
 * Resultado por item: cumple | no_cumple | requiere_revision | no_aplica.
 * Resultado global calculado automaticamente (nunca por el operador):
 * - Si algun item = no_cumple => NO_CUMPLE
 * - si no, si algun item = requiere_revision => REQUIERE_REVISION
 * - si todos los items aplicables = no_aplica => NO_APLICA
 * - en cualquier otro caso => CUMPLE
 */

let ensured = false;

export type InspectionItemResult = "cumple" | "no_cumple" | "requiere_revision" | "no_aplica";

export type ActivimetroInspectionChecklistItem = {
    id: number;
    item_code: string;
    item_label: string;
    item_order: number;
    active: boolean;
};

export type ActivimetroInspection = {
    id: number;
    equipment_id: number | null;
    inspection_date: string;
    inspection_time: string | null;
    performed_by: string | null;
    physicist_reviewed_by: string | null;
    overall_result: string;
    observaciones: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type ActivimetroInspectionItemRecord = {
    id: number;
    inspection_id: number;
    item_code: string;
    item_label: string;
    result: InspectionItemResult;
    comments: string | null;
};

export async function ensureActivimetroInspectionTables() {
    if (ensured) return;
    await ensureActivimetroArchitectureTables();

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_inspection_checklist (
      id SERIAL PRIMARY KEY,
          item_code TEXT NOT NULL UNIQUE,
              item_label TEXT NOT NULL,
                  item_order INTEGER NOT NULL DEFAULT 0,
                      active BOOLEAN NOT NULL DEFAULT true,
                          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                            );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_inspections (
      id SERIAL PRIMARY KEY,
          equipment_id INTEGER REFERENCES qc_activimetro_equipment(id) ON DELETE SET NULL,
              inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
                  inspection_time TIME,
                      performed_by TEXT,
                          physicist_reviewed_by TEXT,
                              overall_result TEXT NOT NULL DEFAULT 'pendiente_revision',
                                  observaciones TEXT,
                                      created_by TEXT,
                                          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                );`;

  await sql`CREATE TABLE IF NOT EXISTS qc_activimetro_inspection_items (
      id SERIAL PRIMARY KEY,
          inspection_id INTEGER NOT NULL REFERENCES qc_activimetro_inspections(id) ON DELETE CASCADE,
              item_code TEXT NOT NULL,
                  item_label TEXT NOT NULL,
                      result TEXT NOT NULL,
                          comments TEXT,
                              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                );`;

  await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_inspections_equipment ON qc_activimetro_inspections(equipment_id, inspection_date DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_qc_activ_inspection_items_inspection ON qc_activimetro_inspection_items(inspection_id);`;

  await seedInspectionChecklist();

  // Marca ACTIV-01 como implementado en el catalogo (seccion 4/48 del prompt maestro).
  await sql`UPDATE qc_activimetro_test_catalog SET implemented = true, updated_at = now() WHERE test_code = 'ACTIV-01' AND implemented = false;`;

  ensured = true;
}

async function seedInspectionChecklist() {
    const items: Array<{ item_code: string; item_label: string; item_order: number }> = [
      { item_code: "integridad_fisica", item_label: "Integridad fisica general del equipo", item_order: 1 },
      { item_code: "camara_medicion", item_label: "Camara de medicion (integridad, limpieza, sin danos)", item_order: 2 },
      { item_code: "porta_viales", item_label: "Porta-viales", item_order: 3 },
      { item_code: "porta_jeringas", item_label: "Porta-jeringas", item_order: 4 },
      { item_code: "pantalla", item_label: "Pantalla / display", item_order: 5 },
      { item_code: "teclado", item_label: "Teclado / panel de control", item_order: 6 },
      { item_code: "conectores", item_label: "Conectores y cables", item_order: 7 },
      { item_code: "fuente_alimentacion", item_label: "Fuente de alimentacion", item_order: 8 },
      { item_code: "limpieza", item_label: "Limpieza general del equipo", item_order: 9 },
      { item_code: "identificacion", item_label: "Identificacion del equipo (etiquetas, codigo interno)", item_order: 10 },
      { item_code: "funcionamiento_general", item_label: "Funcionamiento general (encendido, autochequeo)", item_order: 11 },
      { item_code: "documentacion", item_label: "Documentacion disponible (manual, certificados, registros)", item_order: 12 },
        ];

  for (const item of items) {
        await sql`INSERT INTO qc_activimetro_inspection_checklist (item_code, item_label, item_order)
              VALUES (${item.item_code}, ${item.item_label}, ${item.item_order})
                    ON CONFLICT (item_code) DO NOTHING;`;
  }
}

export async function listActivimetroInspectionChecklist(): Promise<ActivimetroInspectionChecklistItem[]> {
    await ensureActivimetroInspectionTables();
    const { rows } = await sql`SELECT * FROM qc_activimetro_inspection_checklist WHERE active = true ORDER BY item_order ASC;`;
    return rows as ActivimetroInspectionChecklistItem[];
}

function computeOverallResult(items: Array<{ result: InspectionItemResult }>): string {
    if (items.some((i) => i.result === "no_cumple")) return "NO_CUMPLE";
    if (items.some((i) => i.result === "requiere_revision")) return "REQUIERE_REVISION";
    if (items.length > 0 && items.every((i) => i.result === "no_aplica")) return "NO_APLICA";
    return "CUMPLE";
}

export async function createActivimetroInspection(input: {
    equipment_id: number | null;
    inspection_date: string;
    inspection_time?: string | null;
    performed_by?: string | null;
    physicist_reviewed_by?: string | null;
    observaciones?: string | null;
    created_by?: string | null;
    items: Array<{ item_code: string; item_label: string; result: InspectionItemResult; comments?: string | null }>;
}) {
    await ensureActivimetroInspectionTables();

  const overall = computeOverallResult(input.items);

  const { rows } = await sql`INSERT INTO qc_activimetro_inspections
      (equipment_id, inspection_date, inspection_time, performed_by, physicist_reviewed_by, overall_result, observaciones, created_by)
          VALUES (${input.equipment_id}, ${input.inspection_date}, ${input.inspection_time ?? null}, ${input.performed_by ?? null}, ${input.physicist_reviewed_by ?? null}, ${overall}, ${input.observaciones ?? null}, ${input.created_by ?? null})
              RETURNING *;`;
    const inspection = rows[0] as ActivimetroInspection;

  for (const item of input.items) {
        await sql`INSERT INTO qc_activimetro_inspection_items (inspection_id, item_code, item_label, result, comments)
              VALUES (${inspection.id}, ${item.item_code}, ${item.item_label}, ${item.result}, ${item.comments ?? null});`;
  }

  await recordActivimetroAuditLog({
        entity_type: "qc_activimetro_inspections",
        entity_id: inspection.id,
        action: "create",
        field_name: "overall_result",
        old_value: null,
        new_value: overall,
        changed_by: input.created_by ?? null,
  });

  return inspection;
}

export async function listActivimetroInspections(equipmentId?: number): Promise<ActivimetroInspection[]> {
    await ensureActivimetroInspectionTables();
    const { rows } = equipmentId
      ? await sql`SELECT * FROM qc_activimetro_inspections WHERE equipment_id = ${equipmentId} ORDER BY inspection_date DESC, id DESC;`
          : await sql`SELECT * FROM qc_activimetro_inspections ORDER BY inspection_date DESC, id DESC LIMIT 200;`;
    return rows as ActivimetroInspection[];
}

export async function getActivimetroInspectionById(id: number): Promise<{ inspection: ActivimetroInspection; items: ActivimetroInspectionItemRecord[] } | null> {
    await ensureActivimetroInspectionTables();
    const { rows: inspectionRows } = await sql`SELECT * FROM qc_activimetro_inspections WHERE id = ${id};`;
    if (!inspectionRows[0]) return null;
    const { rows: itemRows } = await sql`SELECT * FROM qc_activimetro_inspection_items WHERE inspection_id = ${id} ORDER BY id ASC;`;
    return {
          inspection: inspectionRows[0] as ActivimetroInspection,
          items: itemRows as ActivimetroInspectionItemRecord[],
    };
}
