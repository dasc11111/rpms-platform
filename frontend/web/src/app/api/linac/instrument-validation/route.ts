import { NextResponse } from "next/server";
import { validateInstrument } from "@/lib/linac-instrument-validation";
import { createCalibrationAlertIfNeeded } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("instrument") || "").trim();
  const linacId = searchParams.get("linacId") ? Number(searchParams.get("linacId")) : null;
  const result = await validateInstrument(q);

  let alertId: number | null = null;
  if (result.found) {
    alertId = await createCalibrationAlertIfNeeded({
      linacId,
      instrumentId: result.instrumento.id,
      instrumentCode: result.instrumento.code,
      instrumentName: result.instrumento.name,
      calibrationLevel: result.estadoCalibracion.nivel,
      daysRemaining: result.estadoCalibracion.diasRestantes,
    });
  }

  return NextResponse.json({ ...result, alertId });
}
