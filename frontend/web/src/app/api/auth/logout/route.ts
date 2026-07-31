import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { logAudit } from "@/lib/auth-db";

export async function POST(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (payload) {
          await logAudit({ actorEmail: payload.email, action: "logout", category: "auth", success: true });
    }
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
}
