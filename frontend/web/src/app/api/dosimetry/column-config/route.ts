import { NextResponse } from 'next/server';
import { getQuarterlyColumnConfig, learnQuarterlyColumnMapping } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

// Importacion inteligente (hoja 'Reportes por trimestre'): expone el mapeo
// de columnas aprendido/actual para que el cliente pueda reconocer
// automaticamente las columnas del archivo importado, y permite ensenarle
// al sistema una nueva asociacion cuando aparece un encabezado desconocido.

export async function GET() {
  const fields = await getQuarterlyColumnConfig();
  return NextResponse.json({ ok: true, fields });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const fieldKey = String(body?.fieldKey ?? '').trim();
  const headerText = String(body?.headerText ?? '').trim();
  if (!fieldKey || !headerText) {
    return NextResponse.json({ ok: false, error: 'fieldKey y headerText son requeridos.' }, { status: 400 });
  }
  const learned = await learnQuarterlyColumnMapping(fieldKey, headerText);
  if (!learned) {
    return NextResponse.json({ ok: false, error: 'Campo no reconocido.' }, { status: 400 });
  }
  const fields = await getQuarterlyColumnConfig();
  return NextResponse.json({ ok: true, fields });
}
