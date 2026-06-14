import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { uiText } from "@/lib/language-pack";

const AUTH_SESSION_COOKIE = "agentworld_session";
const PUBLIC_PATHS = new Set(["/", "/signin"]);
const PUBLIC_PREFIXES = [
  "/api/webhooks/",
  "/api/finding-feedback/",
  "/api/knowledge/query",
  "/api/knowledge/read",
  "/api/knowledge/retrieve",
  "/api/auth/plugins/",
];
const PUBLIC_PAGE_PREFIXES = ["/finding-feedback/"];
const PUBLIC_API_PATHS = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/session"]);

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (!isPublicPath(pathname) && !sessionCookie) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        {
          ok: false,
          code: "authentication_required",
          error: uiText("ui.api.errors.authenticationRequired", "Authentication required."),
        },
        { status: 401 },
      );
    }
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
