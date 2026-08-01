import { NextResponse } from 'next/server';
import { getAnnualSummary } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

// Hoja 'Resumen anual' de la planilla oficial: un renglon por trabajador,
// tipo de dosimetro y ano, con la dosis de cada trimestre y el total anual.
// Se calcula en vivo a partir de 'Reportes por trimestre' (dosimetry_quarterly).
export async function GET() {
  try {
    const rows = await getAnnualSummary();
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
