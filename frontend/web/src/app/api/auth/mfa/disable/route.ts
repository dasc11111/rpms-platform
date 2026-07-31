import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById, verifyTotp } from "@/lib/auth";
import { logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
    const totpToken = (body.token || "").toString();

  const user = await getUserById(payload.uid);
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
          return NextResponse.json({ error: "MFA no esta activo" }, { status: 400 });
    }

  const valid = verifyTotp(user.mfa_secret, totpToken);
    if (!valid) return NextResponse.json({ error: "Codigo invalido" }, { status: 400 });

  await sql`UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = now() WHERE id = ${user.id};`;
    await logAudit({ actorEmail: user.email, action: "mfa_disabled", category: "auth", success: true });

  return NextResponse.json({ success: true });
}
