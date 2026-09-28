/**
 * Minimal shared-password gate for the public demo. The password lives only in
 * the DEMO_PASSWORD environment variable (a Container Apps secret); the browser
 * keeps an HMAC-derived session token, never the password itself.
 */

export const SESSION_COOKIE = "contoso_demo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const TOKEN_CONTEXT = "contoso-genui-demo-session:v1";

const encoder = new TextEncoder();

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in constant time by comparing fixed-length digests. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([hmacHex(TOKEN_CONTEXT, a), hmacHex(TOKEN_CONTEXT, b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da.charCodeAt(i) ^ db.charCodeAt(i);
  return diff === 0 && a.length === b.length;
}

export function sessionToken(password: string): Promise<string> {
  return hmacHex(password, TOKEN_CONTEXT);
}

export async function isValidSession(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  return safeEqual(token, await sessionToken(password));
}

export async function passwordMatches(candidate: string, password: string): Promise<boolean> {
  if (!candidate) return false;
  return safeEqual(candidate, password);
}

/** The gate is off when no password is configured, e.g. during local development. */
export function configuredPassword(): string | undefined {
  const value = process.env.DEMO_PASSWORD?.trim();
  return value ? value : undefined;
}
