import { NextResponse, type NextRequest } from "next/server";

// Coarse gate on cookie presence; every page and API route still validates the session server-side.
const PUBLIC = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/admin/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/" || pathname.startsWith("/landing") || pathname.startsWith("/api") || PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("ps_session")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|.*\\.(?:png|svg|jpg|ico)).*)"] };
