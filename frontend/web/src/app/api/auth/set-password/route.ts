import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, hashPassword, isValidPassword } from "@/lib/auth";
import { logAudit } from "@/lib/auth-db";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const password = (body.password || "").toString();
    const ip = req.headers.get("x-forwarded-for") || null;

  if (!email || !password) {
        return NextResponse.json({ error: "Correo y contrasena son requeridos" }, { status: 400 });
  }

  if (!isValidPassword(password)) {
        return NextResponse.json({ error: "La contrasena debe tener al menos 10 caracteres" }, { status: 400 });
  }

  const user = await getUserByEmail(email);

  if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.password_hash) {
        return NextResponse.json({ error: "Esta cuenta ya tiene una contrasena configurada" }, { status: 409 });
  }

  const hash = hashPassword(password);
    await sql`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${user.id};`;

  await logAudit({ actorEmail: email, action: "password_bootstrap_set", category: "auth", ipAddress: ip, success: true });

  return NextResponse.json({ success: true });
}
