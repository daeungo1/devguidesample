import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, configuredPassword, passwordMatches, sessionToken } from "@/lib/demo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAILURE_DELAY_MS = 600;

export async function POST(request: NextRequest) {
  const password = configuredPassword();
  if (!password) return NextResponse.json({ ok: true, gate: "disabled" });

  let candidate = "";
  try {
    const body = await request.json();
    candidate = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!(await passwordMatches(candidate, password))) {
    // Slows down guessing without keeping per-client state.
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
