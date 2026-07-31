import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById, hashPassword, isValidPassword } from "@/lib/auth";
import { logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

async function requireSuperAdmin(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") return null;
    return payload;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const actor = await requireSuperAdmin(req);
    if (!actor) return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });

  const params = await context.params;
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: "Id invalido" }, { status: 400 });

  const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
    const newPassword = (body.newPassword || "").toString();

  if (!isValidPassword(newPassword)) {
        return NextResponse.json({ error: "La contrasena debe tener al menos 10 caracteres" }, { status: 400 });
  }

  const hash = hashPassword(newPassword);
    await sql`UPDATE users SET password_hash = ${hash}, failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = ${id};`;
    await logAudit({ actorEmail: actor.email, action: "password_reset", category: "users", success: true, details: { id, email: target.email } });

  return NextResponse.json({ success: true });
}
