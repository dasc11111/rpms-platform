import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";

export const dynamic = "force-dynamic";

// Asigna un dosimetro a un trabajador. Si el dosimetro ya esta asignado a
// otro trabajador (sin devolucion registrada), se exige que el llamado
// incluya override=true para confirmar explicitamente el reemplazo, tal
// como exige la especificacion de Asignacion de Dosimetros.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDosimeterTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const workerRut = String(body.workerRut || "").trim();
  const workerName = body.workerName || null;
  const service = body.service || null;
  const unit = body.unit || null;
  const deliveryDate = body.deliveryDate || new Date().toISOString().slice(0, 10);
  const estimatedReturnDate = body.estimatedReturnDate || null;
  const observations = body.observations || null;
  const changedBy = body.changedBy || "Usuario RPMS";
  const override = body.override === true;

  if (!workerRut) {
    return NextResponse.json({ error: "worker_rut_required" }, { status: 400 });
  }

  const { rows: currentRows } = await sql`SELECT * FROM dosimeters WHERE id = ${id}`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const alreadyAssignedToOther =
    current.status === "asignado" && current.worker_rut && String(current.worker_rut) !== workerRut;

  if (alreadyAssignedToOther && !override) {
    return NextResponse.json(
      {
        error: "already_assigned",
        currentWorkerRut: current.worker_rut,
        currentWorkerName: current.worker_name,
      },
      { status: 409 }
    );
  }

  // Si habia una asignacion previa (a este u otro trabajador), se cierra su
  // historial antes de abrir la nueva.
  if (current.status === "asignado" && current.worker_rut) {
    await sql`
      UPDATE dosimeter_assignments
      SET actual_return_date = COALESCE(actual_return_date, CURRENT_DATE),
          status_at_close = 'reasignado',
          closed_at = now()
      WHERE dosimeter_id = ${id} AND actual_return_date IS NULL
    `;
  }

  await sql`
    INSERT INTO dosimeter_assignments (
      dosimeter_id, worker_rut, worker_name, service, unit, delivery_date, estimated_return_date, observations
    ) VALUES (
      ${id}, ${workerRut}, ${workerName}, ${service}, ${unit}, ${deliveryDate}, ${estimatedReturnDate}, ${observations}
    )
  `;

  const { rows: updatedRows } = await sql`
    UPDATE dosimeters
    SET status = 'asignado',
        worker_rut = ${workerRut},
        worker_name = ${workerName},
        service = ${service},
        unit = ${unit},
        delivery_date = ${deliveryDate},
        estimated_return_date = ${estimatedReturnDate},
        actual_return_date = NULL,
        observations = ${observations},
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  await sql`
    INSERT INTO dosimeter_history (dosimeter_id, changed_by, field_name, old_value, new_value)
    VALUES (
      ${id}, ${changedBy}, 'asignacion',
      ${current.worker_name ? String(current.worker_name) : null},
      ${"Asignado a " + (workerName || workerRut)}
    )
  `;

  return NextResponse.json({ dosimeter: updatedRows[0] });
}
