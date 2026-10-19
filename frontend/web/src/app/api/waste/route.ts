/**
 * API Route: /api/waste
 * Módulo D – Gestión de Residuos Radiactivos
 * Referencia: DS 133/1984 Art. 47-52, CCHEN Reglamento de Residuos Radiactivos
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  buildWasteDedupeKey,
  calcWasteDerived,
  type WasteRecord,
  type WasteFormInput,
} from "@/lib/waste";

function buildFilters(params: URLSearchParams) {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  let idx = 1;
  const radionuclide = params.get("radionuclide");
  if (radionuclide) { conditions.push(`radionuclide = $${idx++}`); values.push(radionuclide); }
  const waste_category = params.get("waste_category");
  if (waste_category) { conditions.push(`waste_category = $${idx++}`); values.push(waste_category); }
  const state = params.get("state");
  if (state) { conditions.push(`state = $${idx++}`); values.push(state); }
  const origin_area = params.get("origin_area");
  if (origin_area) { conditions.push(`origin_area ILIKE $${idx++}`); values.push(`%${origin_area}%`); }
  const generated_by = params.get("generated_by");
  if (generated_by) { conditions.push(`generated_by ILIKE $${idx++}`); values.push(`%${generated_by}%`); }
  const date_from = params.get("date_from");
  if (date_from) { conditions.push(`initial_activity_date >= $${idx++}`); values.push(date_from); }
  const date_to = params.get("date_to");
  if (date_to) { conditions.push(`initial_activity_date <= $${idx++}`); values.push(date_to); }
  const can_release = params.get("can_release");
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);
  return { conditions, values, limit, offset, filter_can_release: can_release };
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const { conditions, values, limit, offset, filter_can_release } = buildFilters(params);
    const whereClause = conditions.join(" AND ");
    const result = await sql.query(
      `SELECT * FROM waste_records WHERE ${whereClause} ORDER BY initial_activity_date DESC LIMIT ${limit} OFFSET ${offset}`,
      values
    );
    const countResult = await sql.query(`SELECT COUNT(*) FROM waste_records WHERE ${whereClause}`, values);
    const rows = result.rows as WasteRecord[];
    const enriched = rows.map((r) => ({ ...r, derived: calcWasteDerived(r) }));
    const filtered =
      filter_can_release === "true" ? enriched.filter((r) => r.derived.can_release) :
      filter_can_release === "false" ? enriched.filter((r) => !r.derived.can_release) : enriched;
    return NextResponse.json({ data: filtered, total: parseInt(countResult.rows[0].count, 10), limit, offset });
  } catch (err) {
    console.error("[waste GET]", err);
    return NextResponse.json({ error: "Error al obtener residuos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: WasteFormInput = await req.json();
    const { container_label, radionuclide, waste_category, initial_activity_mbq,
      initial_activity_date, mass_or_volume_kg, container_count, origin_area,
      associated_patient_id, generated_by, notes, disposal_route } = body;

    if (!container_label || !radionuclide || !waste_category || !initial_activity_mbq ||
        !initial_activity_date || !origin_area || !generated_by) {
      return NextResponse.json({ error: "Campos obligatorios faltantes" }, { status: 400 });
    }
    if (initial_activity_mbq <= 0) {
      return NextResponse.json({ error: "La actividad inicial debe ser mayor que cero" }, { status: 400 });
    }

    const dedupe_key = buildWasteDedupeKey(container_label, radionuclide, initial_activity_date);

    const result = await sql.query(
      `INSERT INTO waste_records (
        dedupe_key, container_label, radionuclide, waste_category,
        initial_activity_mbq, initial_activity_date, mass_or_volume_kg, container_count,
        origin_area, associated_patient_id, generated_by, notes, state, disposal_route
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'en_almacenamiento',$13)
      ON CONFLICT (dedupe_key) DO UPDATE SET
        initial_activity_mbq = EXCLUDED.initial_activity_mbq, mass_or_volume_kg = EXCLUDED.mass_or_volume_kg,
        container_count = EXCLUDED.container_count, origin_area = EXCLUDED.origin_area,
        generated_by = EXCLUDED.generated_by, notes = EXCLUDED.notes,
        disposal_route = EXCLUDED.disposal_route, updated_at = NOW()
      RETURNING *`,
      [dedupe_key, container_label, radionuclide, waste_category, initial_activity_mbq,
       initial_activity_date, mass_or_volume_kg ?? null, container_count ?? 1,
       origin_area, associated_patient_id ?? null, generated_by, notes ?? null, disposal_route ?? null]
    );

    const record = result.rows[0] as WasteRecord;
    await logHistory(record.id, "CREATE", generated_by, record);
    await upsertSuggestions([
      { field: "container_label", value: container_label },
      { field: "origin_area", value: origin_area },
      { field: "generated_by", value: generated_by },
    ]);
    return NextResponse.json({ ...record, derived: calcWasteDerived(record) });
  } catch (err: unknown) {
    console.error("[waste POST]", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, state, disposal_route, released_by, release_notes } = body;
    if (!id || !state) return NextResponse.json({ error: "id y state son obligatorios" }, { status: 400 });
    const release_date = ["liberado", "transferido", "descartado"].includes(state) ? new Date().toISOString() : null;
    const result = await sql.query(
      `UPDATE waste_records SET state=$1, disposal_route=COALESCE($2,disposal_route),
       release_date=COALESCE($3,release_date), released_by=COALESCE($4,released_by),
       release_notes=COALESCE($5,release_notes), updated_at=NOW() WHERE id=$6 RETURNING *`,
      [state, disposal_route ?? null, release_date, released_by ?? null, release_notes ?? null, id]
    );
    if (result.rows.length === 0) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    const record = result.rows[0] as WasteRecord;
    await logHistory(record.id, "UPDATE_STATE", released_by ?? "sistema", record);
    return NextResponse.json({ ...record, derived: calcWasteDerived(record) });
  } catch (err) {
    console.error("[waste PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar residuo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, deleted_by } = await req.json();
    if (!id) return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
    const check = await sql.query(`SELECT state FROM waste_records WHERE id=$1`, [id]);
    if (check.rows.length === 0) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    if (!["liberado", "transferido", "descartado"].includes(check.rows[0].state)) {
      return NextResponse.json({ error: "Solo se pueden eliminar registros ya liberados o descartados" }, { status: 409 });
    }
    await logHistory(id, "DELETE", deleted_by ?? "sistema", { id });
    await sql.query(`DELETE FROM waste_records WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waste DELETE]", err);
    return NextResponse.json({ error: "Error al eliminar residuo" }, { status: 500 });
  }
}

async function logHistory(record_id: string, action: string, changed_by: string, snapshot: unknown) {
  try {
    await sql.query(
      `INSERT INTO waste_history (record_id, action, changed_by, snapshot) VALUES ($1,$2,$3,$4)`,
      [record_id, action, changed_by, JSON.stringify(snapshot)]
    );
  } catch (e) { console.warn("[waste logHistory]", e); }
}

async function upsertSuggestions(entries: { field: string; value: string }[]) {
  for (const { field, value } of entries) {
    try {
      await sql.query(
        `INSERT INTO waste_field_suggestions (field_name, value, count) VALUES ($1,$2,1)
         ON CONFLICT (field_name, value) DO UPDATE SET count = waste_field_suggestions.count + 1`,
        [field, value]
      );
    } catch (e) { console.warn("[waste upsertSuggestions]", e); }
  }
}
