import { NextResponse } from "next/server";
import { ensureBlindajeTables } from "@/lib/blindaje";

// MODULO: BLINDAJE Y DISENO - inicializacion de tablas (ver docs/BLINDAJE_MASTER_MATRICES.md)
export async function GET() {
  try {
    await ensureBlindajeTables();
    return NextResponse.json({ ok: true, module: "blindaje", message: "Tablas de Blindaje y Diseno verificadas/creadas." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
