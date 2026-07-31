import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById, generateBase32Secret, buildTotpUri } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await getUserById(payload.uid);
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const secret = generateBase32Secret();
    await sql`UPDATE users SET mfa_secret = ${secret}, mfa_enabled = false, updated_at = now() WHERE id = ${user.id};`;

  const otpauthUri = buildTotpUri(secret, user.email);
    return NextResponse.json({ secret, otpauthUri });
}
