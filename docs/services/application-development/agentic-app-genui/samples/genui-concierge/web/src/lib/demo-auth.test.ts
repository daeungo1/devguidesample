import { describe, expect, it } from "vitest";
import { isValidSession, passwordMatches, sessionToken } from "./demo-auth";

describe("demo password gate", () => {
  it("derives a stable token that does not contain the password", async () => {
    const token = await sessionToken("Secret123");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).toBe(await sessionToken("Secret123"));
    expect(token).not.toContain("Secret123");
  });

  it("invalidates sessions when the password changes", async () => {
    const token = await sessionToken("Secret123");
    expect(await isValidSession(token, "Secret123")).toBe(true);
    expect(await isValidSession(token, "Other456")).toBe(false);
  });

  it("rejects missing or malformed session cookies", async () => {
    expect(await isValidSession(undefined, "Secret123")).toBe(false);
    expect(await isValidSession("", "Secret123")).toBe(false);
    expect(await isValidSession("not-a-token", "Secret123")).toBe(false);
  });

  it("matches passwords exactly", async () => {
    expect(await passwordMatches("Secret123", "Secret123")).toBe(true);
    expect(await passwordMatches("secret123", "Secret123")).toBe(false);
    expect(await passwordMatches("Secret1234", "Secret123")).toBe(false);
    expect(await passwordMatches("", "Secret123")).toBe(false);
  });
});
