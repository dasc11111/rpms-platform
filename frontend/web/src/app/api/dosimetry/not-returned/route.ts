import { NextRequest, NextResponse } from 'next/server';
import { getNotReturned, setLostFlag } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

// Hoja 'No devueltos' de la planilla oficial: dosimetros ya informados en
// 'Reportes por trimestre' que aun no figuran en la hoja 'Lista de
// devolucion' para el mismo periodo. Se recalcula en vivo en cada GET.
export async function GET() {
  try {
    const rows = await getNotReturned();
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Permite marcar/desmarcar un dosimetro como extraviado directamente desde
// la vista, sin afectar el resto del calculo (que sigue siendo en vivo).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const dosimetro = String(body?.dosimetro || '').trim();
    const trimestre_d = String(body?.trimestre_d || '').trim();
    const extraviado = Boolean(body?.extraviado);
    if (!dosimetro || !trimestre_d) {
      return NextResponse.json({ ok: false, error: 'dosimetro y trimestre_d son requeridos' }, { status: 400 });
    }
    await setLostFlag(dosimetro, trimestre_d, extraviado);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
