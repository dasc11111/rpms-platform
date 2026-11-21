import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Acta de Liberacion de Sala individual: permite consultar, editar (PUT) y
// eliminar (DELETE) un Acta ya guardada, reutilizando exactamente las mismas
// reglas de validacion y los mismos campos que la creacion (POST /api/room-release).

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const { rows } = await sql`SELECT * FROM room_release_records WHERE id = ${id}`;
  const record = rows[0];
  if (!record) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ row: record });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const body = await req.json();

  const release_date = (body.release_date ?? "").toString();
  const service = (body.service ?? "").toString().trim();
  const sala = (body.sala ?? "").toString().trim();
  const paciente_nombre = (body.paciente_nombre ?? "").toString().trim();
  const radionuclide_code = (body.radionuclide_code ?? "I-131").toString().trim() || "I-131";
  const ubicacion = (body.ubicacion ?? "").toString().trim() || null;
  const puntosMedicion = Array.isArray(body.puntos_medicion) ? body.puntos_medicion : null;

  const errors: string[] = [];
  if (!release_date) errors.push("La fecha de liberación de sala es obligatoria");
  if (!service) errors.push("El servicio es obligatorio");
  if (!sala) errors.push("La sala es obligatoria");
  if (!paciente_nombre) errors.push("El nombre del paciente es obligatorio");
  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const { rows } = await sql`
    UPDATE room_release_records SET
      release_date = ${release_date},
      admission_date = ${body.admission_date ?? null},
      service = ${service},
      sala = ${sala},
      room_number = ${body.room_number ?? null},
      ubicacion = ${ubicacion},
      paciente_nombre = ${paciente_nombre},
      paciente_run = ${body.paciente_run ?? null},
      ficha_clinica = ${body.ficha_clinica ?? null},
      radionuclide_code = ${radionuclide_code},
      actividad_administrada = ${body.actividad_administrada ?? null},
      actividad_medida_liberacion = ${body.actividad_medida_liberacion ?? null},
      unidad_actividad = ${body.unidad_actividad ?? "mCi"},
      tasa_dosis_medida = ${body.tasa_dosis_medida ?? null},
      criterio_liberacion = ${body.criterio_liberacion ?? null},
      responsable_opr = ${body.responsable_opr ?? "Oficial de Protección Radiológica"},
      observaciones = ${body.observaciones ?? null},
      status = ${body.status ?? "liberado"},
      puntos_medicion = ${puntosMedicion ? JSON.stringify(puntosMedicion) : null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  const record = rows[0];
  if (!record) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ row: record });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  try {
    const { rows } = await sql`DELETE FROM room_release_records WHERE id = ${id} RETURNING id`;
    if (!rows[0]) {
      return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23503") {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar: existe un rótulo de residuo generado a partir de esta Acta. Elimine primero el rótulo asociado en Gestión de Residuos Radiactivos.",
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
