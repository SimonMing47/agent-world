import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_SESSION_COOKIE = "agentworld_session";
const PUBLIC_PATHS = new Set(["/", "/signin", "/access-request"]);
const PUBLIC_PREFIXES = ["/api/webhooks/"];
const PUBLIC_API_PATHS = new Set(["/api/auth/dev-login", "/api/auth/dev-mode-login", "/api/auth/session", "/api/access-requests"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isPublicPath(pathname) && !request.cookies.get(AUTH_SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-agentworld-pathname", pathname);
  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: ["/((?!_next|fonts|favicon.ico|icon.svg|apple-icon.png).*)"],
};
