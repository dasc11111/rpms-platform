import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById } from "@/lib/auth";
import { logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

async function requireSuperAdmin(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") return null;
    return payload;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const actor = await requireSuperAdmin(req);
    if (!actor) return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });

  const params = await context.params;
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: "Id invalido" }, { status: 400 });

  const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (target.role === "super_admin") {
        return NextResponse.json({ error: "El Super Administrador no puede modificarse desde este panel" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
    const name = body.name !== undefined ? body.name.toString() : target.name;
    const status = body.status !== undefined ? body.status.toString() : target.status;
    let role = body.role !== undefined ? body.role.toString() : target.role;

  if (role === "super_admin") {
        return NextResponse.json({ error: "No esta permitido asignar el rol de Super Administrador" }, { status: 403 });
  }
    if (role !== "admin" && role !== "user") {
          role = target.role;
    }

  await sql`UPDATE users SET name = ${name}, status = ${status}, role = ${role}, updated_at = now() WHERE id = ${id};`;
    await logAudit({ actorEmail: actor.email, action: "user_updated", category: "users", success: true, details: { id, name, status, role } });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const actor = await requireSuperAdmin(req);
    if (!actor) return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });

  const params = await context.params;
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: "Id invalido" }, { status: 400 });

  const target = await getUserById(id);
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (target.role === "super_admin") {
        return NextResponse.json({ error: "El Super Administrador no puede ser eliminado" }, { status: 403 });
  }

  await sql`DELETE FROM users WHERE id = ${id};`;
    await logAudit({ actorEmail: actor.email, action: "user_deleted", category: "users", success: true, details: { id, email: target.email } });

  return NextResponse.json({ success: true });
}
