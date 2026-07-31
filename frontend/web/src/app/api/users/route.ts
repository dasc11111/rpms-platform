import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { hashPassword, isValidPassword, isSuperAdminEmail } from "@/lib/auth";
import { ensureAuthSchema, logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

async function requireSuperAdmin(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload || payload.role !== "super_admin") return null;
    return payload;
}

export async function GET(req: NextRequest) {
    const actor = await requireSuperAdmin(req);
    if (!actor) return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });

  await ensureAuthSchema();
    const { rows } = await sql`
        SELECT id, email, name, role, status, mfa_enabled, failed_login_attempts, locked_until, last_login_at, created_at, updated_at
            FROM users ORDER BY created_at ASC;
              `;
    return NextResponse.json({ users: rows });
}

export async function POST(req: NextRequest) {
    const actor = await requireSuperAdmin(req);
    if (!actor) return NextResponse.json({ error: "Acceso restringido" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const name = (body.name || "").toString().trim();
    const password = (body.password || "").toString();
    const role = (body.role || "user").toString();

  if (!email || !password) {
        return NextResponse.json({ error: "Correo y contrasena son requeridos" }, { status: 400 });
  }

  if (!isValidPassword(password)) {
        return NextResponse.json({ error: "La contrasena debe tener al menos 10 caracteres" }, { status: 400 });
  }

  if (role === "super_admin" || isSuperAdminEmail(email)) {
        return NextResponse.json({ error: "No esta permitido crear o asignar un Super Administrador adicional" }, { status: 403 });
  }

  if (role !== "admin" && role !== "user") {
        return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
  }

  await ensureAuthSchema();
    const hash = hashPassword(password);

  try {
        const { rows } = await sql`
              INSERT INTO users (email, name, password_hash, role, status)
                    VALUES (${email}, ${name || null}, ${hash}, ${role}, 'active')
                          RETURNING id, email, name, role, status, created_at;
                              `;
        await logAudit({ actorEmail: actor.email, action: "user_created", category: "users", success: true, details: { email, role } });
        return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch (err: any) {
        if (err && err.code === "23505") {
                return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
        }
        throw err;
  }
}
