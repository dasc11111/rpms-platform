import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables, logTransportAudit } from "@/lib/transport";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureTransportTables();
  const { rows } = await sql`SELECT code, label, activity_label, allows_multiple FROM transport_radionuclides ORDER BY label;`;
  return NextResponse.json({
    ok: true,
    radionuclides: rows.map((r: any) => ({
      code: r.code,
      label: r.label,
      activityLabel: r.activity_label,
      allowsMultiple: r.allows_multiple,
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureTransportTables();
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySession(token);
  if (!payload || (payload.role !== "super_admin" && payload.role !== "admin")) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const label = String(body.label || "").trim();
  const activityLabel = String(body.activityLabel || "Actividad transportada (mCi)").trim();
  const allowsMultiple = Boolean(body.allowsMultiple);

  if (!code || !label) {
    return NextResponse.json({ error: "code_and_label_required" }, { status: 400 });
  }

  await sql`
    INSERT INTO transport_radionuclides (code, label, activity_label, allows_multiple)
    VALUES (${code}, ${label}, ${activityLabel}, ${allowsMultiple})
    ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, activity_label = EXCLUDED.activity_label, allows_multiple = EXCLUDED.allows_multiple;
  `;

  await logTransportAudit("create_radionuclide", payload.email || null, { code, label });

  const { rows } = await sql`SELECT code, label, activity_label, allows_multiple FROM transport_radionuclides ORDER BY label;`;
  return NextResponse.json({
    ok: true,
    radionuclides: rows.map((r: any) => ({
      code: r.code,
      label: r.label,
      activityLabel: r.activity_label,
      allowsMultiple: r.allows_multiple,
    })),
  });
}
