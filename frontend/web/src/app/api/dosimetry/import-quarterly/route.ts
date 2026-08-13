import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { rutMatchKey } from '@/lib/rut';
import { syncAnnualDoseForWorkers } from '@/lib/dosimetry-sync';
import { ensureDosimetryTables, toNum, qualCode, levelFor, parsePeriodo, buildQuarterlyDoseAlertSummaries } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

function corsHeaders() {
 return {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type',
 };
}

export async function OPTIONS() {
 return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function rutBody(v: unknown): string {
 return rutMatchKey(String(v ?? ''));
}

type Agg = {
 worker_rut: string; worker_name: string; institucion: string; departamento: string;
 year: number; quarter: number; label: string; tipo: string;
 dosimetro: string | null; radiacion: string | null; proceso: string | null;
 dose_body: number; dose_lens: number; dose_skin: number;
 dose_body_code: string | null; dose_lens_code: string | null; dose_skin_code: string | null;
 accum_year_body: number; accum_year_lens: number; accum_year_skin: number;
 accum_12m_body: number; accum_12m_lens: number; accum_12m_skin: number;
 accum_60m_body: number; accum_60m_lens: number; accum_60m_skin: number;
};

// Filas posicionales en el MISMO orden de columnas de la hoja 'Reportes por
// trimestre' de la planilla oficial 'Resumen - 908.xlsm':
// [0] INSTITUCION [5] Hp(10) cualitativo [11] Suma Hp(10) ano cal. [17] Suma Hp(10) 60m
// [1] DEPARTAMENTO [6] Hp(3) cualitativo [12] Suma Hp(3) ano cal. [18] Suma Hp(3) 60m
// [2] PERIODO [7] Hp(0.07) cualitativo [13] Suma piel ano cal. [19] Suma piel 60m
// [3] NOMBRE [8] Hp(10) cuantitativo [14] Suma Hp(10) 12m [20] tipo
// [4] RUN [9] Hp(3) cuantitativo [15] Suma Hp(3) 12m [21] radiacion
// [10] Hp(0.07) cuantitativo [16] Suma piel 12m [22] proceso
// [23] dosimetro
export async function POST(request: Request) {
 const body = await request.json().catch(() => ({}));
 const rows: any[][] = Array.isArray(body?.rows) ? body.rows : [];

 await ensureDosimetryTables();

 const { rows: workers } = await sql`SELECT rut, name FROM workers`;
 const rutMap = new Map<string, { rut: string; name: string }>();
 for (const w of workers as any[]) {
 const key = rutBody(w.rut);
 if (key) rutMap.set(key, w as any);
 }

 const agg = new Map<string, Agg>();
 let unmatched = 0;
 const unmatchedSamples: string[] = [];

 for (const r of rows) {
 const run = String(r[4] ?? '').trim();
 const key0 = rutBody(run);
 const worker = rutMap.get(key0);
 if (!worker || !key0) {
 unmatched++;
 if (unmatchedSamples.length < 30) unmatchedSamples.push(run);
 continue;
 }
 const periodo = parsePeriodo(r[2]);
 if (!periodo) continue;

 const institucion = String(r[0] ?? '');
 const departamento = String(r[1] ?? '');
 const tipo = String(r[20] ?? '').trim() || 'C.E.';
 const radiacion = String(r[21] ?? '').trim() || null;
 const proceso = String(r[22] ?? '').trim() || null;
 const dosimetro = String(r[23] ?? '').trim() || null;

 const doseBody = toNum(r[8]);
 const doseLens = toNum(r[9]);
 const doseSkin = toNum(r[10]);
 const doseBodyCode = qualCode(r[5]) ?? qualCode(r[8]);
 const doseLensCode = qualCode(r[6]) ?? qualCode(r[9]);
 const doseSkinCode = qualCode(r[7]) ?? qualCode(r[10]);

 const accumYearBody = toNum(r[11]);
 const accumYearLens = toNum(r[12]);
 const accumYearSkin = toNum(r[13]);
 const accum12mBody = toNum(r[14]);
 const accum12mLens = toNum(r[15]);
 const accum12mSkin = toNum(r[16]);
 const accum60mBody = toNum(r[17]);
 const accum60mLens = toNum(r[18]);
 const accum60mSkin = toNum(r[19]);

 const key = worker.rut + '__' + periodo.year + '__' + periodo.quarter + '__' + tipo;
 const existing = agg.get(key);
 if (existing) {
 existing.dose_body += doseBody;
 existing.dose_lens += doseLens;
 existing.dose_skin += doseSkin;
 existing.dose_body_code = existing.dose_body_code ?? doseBodyCode;
 existing.dose_lens_code = existing.dose_lens_code ?? doseLensCode;
 existing.dose_skin_code = existing.dose_skin_code ?? doseSkinCode;
 existing.accum_year_body = Math.max(existing.accum_year_body, accumYearBody);
 existing.accum_year_lens = Math.max(existing.accum_year_lens, accumYearLens);
 existing.accum_year_skin = Math.max(existing.accum_year_skin, accumYearSkin);
 existing.accum_12m_body = Math.max(existing.accum_12m_body, accum12mBody);
 existing.accum_12m_lens = Math.max(existing.accum_12m_lens, accum12mLens);
 existing.accum_12m_skin = Math.max(existing.accum_12m_skin, accum12mSkin);
 existing.accum_60m_body = Math.max(existing.accum_60m_body, accum60mBody);
 existing.accum_60m_lens = Math.max(existing.accum_60m_lens, accum60mLens);
 existing.accum_60m_skin = Math.max(existing.accum_60m_skin, accum60mSkin);
 existing.dosimetro = existing.dosimetro ?? dosimetro;
 existing.radiacion = existing.radiacion ?? radiacion;
 existing.proceso = existing.proceso ?? proceso;
 } else {
 agg.set(key, {
 worker_rut: worker.rut, worker_name: worker.name,
 institucion, departamento,
 year: periodo.year, quarter: periodo.quarter, label: periodo.label, tipo,
 dosimetro, radiacion, proceso,
 dose_body: doseBody, dose_lens: doseLens, dose_skin: doseSkin,
 dose_body_code: doseBodyCode, dose_lens_code: doseLensCode, dose_skin_code: doseSkinCode,
 accum_year_body: accumYearBody, accum_year_lens: accumYearLens, accum_year_skin: accumYearSkin,
 accum_12m_body: accum12mBody, accum_12m_lens: accum12mLens, accum_12m_skin: accum12mSkin,
 accum_60m_body: accum60mBody, accum_60m_lens: accum60mLens, accum_60m_skin: accum60mSkin,
 });
 }
 }

 let inserted = 0;
 for (const a of agg.values()) {
 const level = levelFor(a.dose_body);
 await sql`
 INSERT INTO dosimetry_quarterly (
 worker_rut, worker_name, institucion, departamento, year, quarter, period_label, tipo,
 dosimetro, radiacion, proceso,
 dose_body, dose_lens, dose_skin, dose_body_code, dose_lens_code, dose_skin_code,
 accum_year_body, accum_year_lens, accum_year_skin,
 accum_12m_body, accum_12m_lens, accum_12m_skin,
 accum_60m_body, accum_60m_lens, accum_60m_skin, level, updated_at
 ) VALUES (
 ${a.worker_rut}, ${a.worker_name}, ${a.institucion}, ${a.departamento}, ${a.year}, ${a.quarter}, ${a.label}, ${a.tipo},
 ${a.dosimetro}, ${a.radiacion}, ${a.proceso},
 ${a.dose_body}, ${a.dose_lens}, ${a.dose_skin}, ${a.dose_body_code}, ${a.dose_lens_code}, ${a.dose_skin_code},
 ${a.accum_year_body}, ${a.accum_year_lens}, ${a.accum_year_skin},
 ${a.accum_12m_body}, ${a.accum_12m_lens}, ${a.accum_12m_skin},
 ${a.accum_60m_body}, ${a.accum_60m_lens}, ${a.accum_60m_skin}, ${level}, now()
 )
 ON CONFLICT (worker_rut, year, quarter, tipo) DO UPDATE SET
 dose_body = EXCLUDED.dose_body,
 dose_lens = EXCLUDED.dose_lens,
 dose_skin = EXCLUDED.dose_skin,
 dose_body_code = EXCLUDED.dose_body_code,
 dose_lens_code = EXCLUDED.dose_lens_code,
 dose_skin_code = EXCLUDED.dose_skin_code,
 dosimetro = EXCLUDED.dosimetro,
 radiacion = EXCLUDED.radiacion,
 proceso = EXCLUDED.proceso,
 accum_year_body = EXCLUDED.accum_year_body,
 accum_year_lens = EXCLUDED.accum_year_lens,
 accum_year_skin = EXCLUDED.accum_year_skin,
 accum_12m_body = EXCLUDED.accum_12m_body,
 accum_12m_lens = EXCLUDED.accum_12m_lens,
 accum_12m_skin = EXCLUDED.accum_12m_skin,
 accum_60m_body = EXCLUDED.accum_60m_body,
 accum_60m_lens = EXCLUDED.accum_60m_lens,
 accum_60m_skin = EXCLUDED.accum_60m_skin,
 level = EXCLUDED.level,
 updated_at = now()
 `;
 inserted++;
 }

 const currentYear = new Date().getFullYear();
 const synced = await syncAnnualDoseForWorkers(
 Array.from(agg.values()).map((a) => a.worker_rut),
 currentYear
 );

const alerts = buildQuarterlyDoseAlertSummaries(
     Array.from(agg.values()).map((a) => ({
            worker_rut: a.worker_rut,
            worker_name: a.worker_name,
            year: a.year,
            quarter: a.quarter,
            period_label: a.label,
            dose_body: a.dose_body,
     }))
   );

   return NextResponse.json(
    { ok: true, totalRows: rows.length, matchedGroups: agg.size, inserted, unmatched, unmatchedSamples, synced, alerts },
    { headers: corsHeaders() }
      );
}
