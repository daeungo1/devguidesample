import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, configuredPassword, isValidSession } from "@/lib/demo-auth";

export const config = {
  // Node.js runtime reads DEMO_PASSWORD at request time instead of build time.
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|login|api/login).*)"],
};

export async function middleware(request: NextRequest) {
  const password = configuredPassword();
  if (!password) return NextResponse.next();

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value, password)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}
