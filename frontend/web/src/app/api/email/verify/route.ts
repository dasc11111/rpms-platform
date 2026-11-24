/**
 * GET /api/email/verify
 * Verifica si la conexión SMTP con Gmail está funcionando
 */
import { NextResponse } from "next/server";
import { verifyEmailConnection } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "Variables GMAIL_USER y/o GMAIL_APP_PASSWORD no están configuradas",
      gmailUser: null,
    });
  }

  const result = await verifyEmailConnection();

  return NextResponse.json({
    ok: result.ok,
    configured: true,
    gmailUser: process.env.GMAIL_USER,
    error: result.error ?? null,
  });
}
