import { NextResponse } from 'next/server';
import { getLateReturns } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

// Hoja 'Devueltos fuera de plazo' de la planilla oficial: dosimetros cuya
// fecha de proceso/lectura de laboratorio quedo mas de 45 dias despues del
// cierre del trimestre informado en 'Reportes por trimestre'.
export async function GET() {
  try {
    const rows = await getLateReturns();
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
