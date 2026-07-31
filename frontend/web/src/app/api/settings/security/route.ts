import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { ensureAuthSchema, logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") {
          return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });
    }

  await ensureAuthSchema();
    const { rows } = await sql`SELECT value FROM platform_settings WHERE key = 'session_timeout_minutes';`;
    const sessionTimeoutMinutes = rows[0] ? Number(rows[0].value) : 30;

  return NextResponse.json({ sessionTimeoutMinutes });
}

export async function PATCH(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") {
          return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });
    }

  const body = await req.json().catch(() => ({}));
    const minutes = parseInt(body.sessionTimeoutMinutes, 10);

  if (!minutes || minutes < 1 || minutes > 1440) {
        return NextResponse.json({ error: "Valor invalido (1 a 1440 minutos)" }, { status: 400 });
  }

  await ensureAuthSchema();
    await sql`
        INSERT INTO platform_settings (key, value, updated_at)
            VALUES ('session_timeout_minutes', ${JSON.stringify(minutes)}::jsonb, now())
                ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(minutes)}::jsonb, updated_at = now();
                  `;

  await logAudit({ actorEmail: payload.email, action: "settings_updated", category: "settings", success: true, details: { sessionTimeoutMinutes: minutes } });

  return NextResponse.json({ success: true });
}
