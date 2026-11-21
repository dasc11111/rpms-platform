import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById } from "@/lib/auth";
import { logAudit } from "@/lib/auth-db";
import { hashPassword, verifyPassword, isValidPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySession(token);
  if (!payload) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = await getUserById(payload.uid);
  if (!user || (user as Record<string, unknown>).status !== "active") {
    return NextResponse.json({ error: "Usuario no encontrado o inactivo" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = (body.currentPassword || "").toString();
  const newPassword = (body.newPassword || "").toString();
  const ip = req.headers.get("x-forwarded-for") || null;
  const userRecord = user as Record<string, unknown>;
  const email = String(userRecord.email || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Se requiere la contrasena actual y la nueva contrasena" },
      { status: 400 }
    );
  }

  if (!isValidPassword(newPassword)) {
    return NextResponse.json(
      { error: "La nueva contrasena debe tener al menos 10 caracteres" },
      { status: 400 }
    );
  }

  const passwordHash = String(userRecord.password_hash || "");
  if (!passwordHash) {
    return NextResponse.json(
      { error: "Esta cuenta no tiene contrasena configurada. Usa el flujo de primer acceso." },
      { status: 400 }
    );
  }

  const valid = verifyPassword(currentPassword, passwordHash);
  if (!valid) {
    await logAudit({
      actorEmail: email,
      action: "password_change_failed",
      category: "auth",
      ipAddress: ip,
      success: false,
      details: { reason: "wrong_current_password" },
    });
    return NextResponse.json({ error: "La contrasena actual es incorrecta" }, { status: 401 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "La nueva contrasena debe ser diferente a la actual" },
      { status: 400 }
    );
  }

  const newHash = hashPassword(newPassword);
  await sql`UPDATE users SET password_hash = ${newHash}, updated_at = now() WHERE id = ${payload.uid};`;

  await logAudit({
    actorEmail: email,
    action: "password_changed",
    category: "auth",
    ipAddress: ip,
    success: true,
  });

  return NextResponse.json({ success: true });
}
