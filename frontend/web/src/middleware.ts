import { NextRequest, NextResponse } from "next/server";
import { verifySession, signSession, SESSION_COOKIE_NAME } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/set-password", "/api/auth/logout", "/api/auth/session"];

function isPublic(pathname: string) {
    if (PUBLIC_PATHS.includes(pathname)) return true;
    if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
    if (/\.(svg|png|jpg|jpeg|ico|css|js|map)$/.test(pathname)) return true;
    return false;
}

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

  if (isPublic(pathname)) {
        return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = await verifySession(token);

  if (!payload) {
        if (pathname.startsWith("/api/")) {
                return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }
        const loginUrl = new URL("/login", req.url);
        return NextResponse.redirect(loginUrl);
  }

  const isSuperAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/users") || pathname.startsWith("/api/audit");
    if (isSuperAdminArea && payload.role !== "super_admin") {
          if (pathname.startsWith("/api/")) {
                  return NextResponse.json({ error: "Acceso restringido al Super Administrador" }, { status: 403 });
          }
          return NextResponse.redirect(new URL("/", req.url));
    }

  const now = Date.now();
    const ttlMs = payload.ttlMs || 30 * 60 * 1000;
    const newToken = await signSession({ uid: payload.uid, email: payload.email, role: payload.role, iat: now, exp: now + ttlMs, ttlMs: ttlMs });

  const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE_NAME, newToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: Math.floor(ttlMs / 1000),
    });
    return res;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
