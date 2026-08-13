import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { syncAnnualDoseForWorker } from '@/lib/dosimetry-sync';
import { ensureDosimetryTables, toNum, levelFor, buildQuarterlyDoseAlertSummaries } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
 const body: any = await request.json().catch(() => ({}));
 const worker_rut = String(body?.worker_rut ?? '').trim();
 const year = Number(body?.year);
 const quarter = Number(body?.quarter);
 const tipo = String(body?.tipo ?? 'C.E.').trim() || 'C.E.';

 if (!worker_rut || !year || !quarter || quarter < 1 || quarter > 4) {
 return NextResponse.json(
 { ok: false, error: 'Datos incompletos: trabajador, ano y trimestre son obligatorios.' },
 { status: 400 }
 );
 }

 await ensureDosimetryTables();

 const { rows: workerRows } = await sql`SELECT rut, name FROM workers WHERE rut = ${worker_rut} LIMIT 1`;
 if (workerRows.length === 0) {
 return NextResponse.json({ ok: false, error: 'No se encontro un trabajador con ese RUT.' }, { status: 404 });
 }
 const worker: any = workerRows[0];

 const dose_body = toNum(body?.dose_body);
 const dose_lens = toNum(body?.dose_lens);
 const dose_skin = toNum(body?.dose_skin);
 const accum_year_body = toNum(body?.accum_year_body);
 const accum_12m_body = toNum(body?.accum_12m_body);
 const accum_60m_body = toNum(body?.accum_60m_body);
 const accum_60m_lens = toNum(body?.accum_60m_lens);
 const accum_60m_skin = toNum(body?.accum_60m_skin);
 const institucion = String(body?.institucion ?? '');
 const departamento = String(body?.departamento ?? '');
 const dosimetro = String(body?.dosimetro ?? '').trim() || null;
 const radiacion = String(body?.radiacion ?? '').trim() || null;
 const period_label = `T${quarter}-${year}`;
 const level = levelFor(dose_body);

 await sql`
 INSERT INTO dosimetry_quarterly (
 worker_rut, worker_name, institucion, departamento, year, quarter, period_label, tipo,
 dosimetro, radiacion,
 dose_body, dose_lens, dose_skin, accum_year_body, accum_12m_body, accum_60m_body,
 accum_60m_lens, accum_60m_skin, level, updated_at
 ) VALUES (
 ${worker.rut}, ${worker.name}, ${institucion}, ${departamento}, ${year}, ${quarter}, ${period_label}, ${tipo},
 ${dosimetro}, ${radiacion},
 ${dose_body}, ${dose_lens}, ${dose_skin}, ${accum_year_body}, ${accum_12m_body}, ${accum_60m_body},
 ${accum_60m_lens}, ${accum_60m_skin}, ${level}, now()
 )
 ON CONFLICT (worker_rut, year, quarter, tipo) DO UPDATE SET
 dose_body = EXCLUDED.dose_body,
 dose_lens = EXCLUDED.dose_lens,
 dose_skin = EXCLUDED.dose_skin,
 dosimetro = EXCLUDED.dosimetro,
 radiacion = EXCLUDED.radiacion,
 accum_year_body = EXCLUDED.accum_year_body,
 accum_12m_body = EXCLUDED.accum_12m_body,
 accum_60m_body = EXCLUDED.accum_60m_body,
 accum_60m_lens = EXCLUDED.accum_60m_lens,
 accum_60m_skin = EXCLUDED.accum_60m_skin,
 level = EXCLUDED.level,
 updated_at = now()
 `;

 const currentYear = new Date().getFullYear();
 const synced = year === currentYear ? await syncAnnualDoseForWorker(worker.rut, year) : false;

 const alerts = buildQuarterlyDoseAlertSummaries([
  { worker_rut: worker.rut, worker_name: worker.name, year, quarter, period_label, dose_body },
  ]);

return NextResponse.json({ ok: true, worker_name: worker.name, period_label, level, synced, alerts });
}
