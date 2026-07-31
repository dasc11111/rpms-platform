import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { ensureAuthSchema } from "@/lib/auth-db";
import { sql } from "@/lib/db";

// Solo lectura. Nunca se implementa un metodo DELETE para este recurso:
// el historial de auditoria nunca debe eliminarse.
export async function GET(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") {
          return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });
    }

  await ensureAuthSchema();

  const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;

  const { rows } = await sql`
      SELECT id, created_at, actor_email, action, category, details, ip_address, success
          FROM audit_logs
              ORDER BY created_at DESC
                  LIMIT ${limit} OFFSET ${offset};
                    `;

  return NextResponse.json({ logs: rows });
}
