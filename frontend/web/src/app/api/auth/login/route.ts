import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, verifyPassword, sanitizeUser, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, verifyTotp } from "@/lib/auth";
import { signSession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const password = (body.password || "").toString();
    const totpToken = (body.totpToken || "").toString();
    const ip = req.headers.get("x-forwarded-for") || null;

  if (!email || !password) {
        return NextResponse.json({ error: "Correo y contrasena son requeridos" }, { status: 400 });
  }

  const user = await getUserByEmail(email);

  if (!user) {
        await logAudit({ actorEmail: email, action: "login_failed", category: "auth", ipAddress: ip, success: false, details: { reason: "user_not_found" } });
        return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
  }

  if (user.status !== "active") {
        await logAudit({ actorEmail: email, action: "login_failed", category: "auth", ipAddress: ip, success: false, details: { reason: "inactive" } });
        return NextResponse.json({ error: "Cuenta suspendida" }, { status: 403 });
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        await logAudit({ actorEmail: email, action: "login_failed", category: "auth", ipAddress: ip, success: false, details: { reason: "locked" } });
        return NextResponse.json({ error: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta mas tarde." }, { status: 423 });
  }

  if (!user.password_hash) {
        return NextResponse.json({ needsPasswordSetup: true });
  }

  const validPassword = verifyPassword(password, user.password_hash);

  if (!validPassword) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        let lockedUntil = null;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
                lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        }
        await sql`UPDATE users SET failed_login_attempts = ${attempts}, locked_until = ${lockedUntil}, updated_at = now() WHERE id = ${user.id};`;
        await logAudit({ actorEmail: email, action: "login_failed", category: "auth", ipAddress: ip, success: false, details: { reason: "bad_password", attempts } });
        return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
  }

  if (user.mfa_enabled) {
        if (!totpToken) {
                return NextResponse.json({ mfaRequired: true });
        }
        const validTotp = verifyTotp(user.mfa_secret, totpToken);
        if (!validTotp) {
                await logAudit({ actorEmail: email, action: "login_failed", category: "auth", ipAddress: ip, success: false, details: { reason: "bad_mfa" } });
                return NextResponse.json({ error: "Codigo MFA invalido" }, { status: 401 });
        }
  }

  await sql`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now() WHERE id = ${user.id};`;

  const { rows: settingsRows } = await sql`SELECT value FROM platform_settings WHERE key = 'session_timeout_minutes';`;
    const timeoutMinutes = settingsRows[0] ? Number(settingsRows[0].value) : 30;
    const ttlMs = timeoutMinutes * 60 * 1000;

  const now = Date.now();
    const token = await signSession({ uid: user.id, email: user.email, role: user.role, iat: now, exp: now + ttlMs, ttlMs: ttlMs });

  await logAudit({ actorEmail: email, action: "login_success", category: "auth", ipAddress: ip, success: true });

  const res = NextResponse.json({ user: sanitizeUser({ ...user, failed_login_attempts: 0 }) });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: Math.floor(ttlMs / 1000),
    });
    return res;
}
