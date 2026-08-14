import { NextResponse } from 'next/server';
import { deleteQuarterlyRecord } from '@/lib/dosimetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const body: any = await request.json().catch(() => ({}));
    const id = Number(body?.id);

  if (!id) {
        return NextResponse.json({ ok: false, error: 'Falta el id del registro a eliminar.' }, { status: 400 });
  }

  const deleted = await deleteQuarterlyRecord(id);
    if (!deleted) {
          return NextResponse.json({ ok: false, error: 'No se encontro el registro indicado.' }, { status: 404 });
    }

  return NextResponse.json({ ok: true });
}
