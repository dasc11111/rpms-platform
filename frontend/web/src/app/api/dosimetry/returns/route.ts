import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureDosimetryTables, RETURN_STATUSES } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

// Replica la hoja 'Lista de devolucion' de la planilla oficial: al ingresar
// el codigo del dosimetro, se busca automaticamente la unidad (departamento),
// nombre, RUN y periodo del ultimo registro cargado para ese dosimetro en
// 'Reportes por trimestre' (tabla dosimetry_quarterly). A diferencia del
// Excel original (que tenia un error de formula en la celda D3, apuntando a
// la columna incorrecta), aqui la busqueda toma directamente el campo
// correcto (departamento).
async function lookupByCode(code: string) {
 const { rows } = await sql`
 SELECT departamento AS unidad, worker_rut, worker_name, period_label
 FROM dosimetry_quarterly
 WHERE dosimetro = ${code}
 ORDER BY year DESC, quarter DESC
 LIMIT 1
 `;
 return rows[0] ?? null;
}

export async function GET(request: Request) {
 await ensureDosimetryTables();
 const { searchParams } = new URL(request.url);
 const code = String(searchParams.get('code') ?? '').trim();

 if (code) {
 const info = await lookupByCode(code);
 return NextResponse.json({ ok: true, found: !!info, info: info ?? null, statuses: RETURN_STATUSES });
 }

 const { rows } = await sql`
 SELECT id, dosimeter_code, unidad, worker_rut, worker_name, period_label, estado, observaciones, registered_by, registered_at
 FROM dosimetry_returns
 ORDER BY registered_at DESC
 LIMIT 100
 `;
 return NextResponse.json({ ok: true, returns: rows, statuses: RETURN_STATUSES });
}

export async function POST(request: Request) {
 await ensureDosimetryTables();
 const body: any = await request.json().catch(() => ({}));
 const dosimeter_code = String(body?.dosimeter_code ?? '').trim();
 const estado = String(body?.estado ?? '').trim();
 const observaciones = String(body?.observaciones ?? '').trim() || null;
 const registered_by = String(body?.registered_by ?? '').trim() || null;

 if (!dosimeter_code) {
 return NextResponse.json({ ok: false, error: 'El codigo del dosimetro es obligatorio.' }, { status: 400 });
 }
 if (!(RETURN_STATUSES as readonly string[]).includes(estado)) {
 return NextResponse.json({ ok: false, error: 'Estado invalido. Debe ser uno de: ' + RETURN_STATUSES.join(', ') }, { status: 400 });
 }

 const info: any = await lookupByCode(dosimeter_code);

 const { rows } = await sql`
 INSERT INTO dosimetry_returns (
 dosimeter_code, unidad, worker_rut, worker_name, period_label, estado, observaciones, registered_by
 ) VALUES (
 ${dosimeter_code}, ${info?.unidad ?? null}, ${info?.worker_rut ?? null}, ${info?.worker_name ?? null},
 ${info?.period_label ?? null}, ${estado}, ${observaciones}, ${registered_by}
 )
 RETURNING id, dosimeter_code, unidad, worker_rut, worker_name, period_label, estado, observaciones, registered_by, registered_at
 `;

 return NextResponse.json({ ok: true, matched: !!info, record: rows[0] });
}
