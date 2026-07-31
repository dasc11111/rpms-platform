import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth-token";
import { getUserById, sanitizeUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);
    if (!payload) {
          return NextResponse.json({ user: null });
    }
    const user = await getUserById(payload.uid);
    if (!user || user.status !== "active") {
          return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user: sanitizeUser(user) });
}
