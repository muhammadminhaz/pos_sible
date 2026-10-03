import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { sameOrigin } from "@/lib/server/auth";

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

describe("sameOrigin", () => {
  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it("accepts requests with no Origin header", () => {
    expect(sameOrigin(req({ host: "api.example.com" }))).toBe(true);
  });

  it("accepts an Origin that matches the request host", () => {
    expect(sameOrigin(req({ origin: "https://api.example.com", host: "api.example.com" }))).toBe(true);
  });

  it("refuses a foreign Origin by default", () => {
    expect(sameOrigin(req({ origin: "https://evil.example", host: "api.example.com" }))).toBe(false);
  });

  it("accepts only the exact origins listed in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = "https://pos.example.com/, http://localhost:3000";
    const host = { host: "api.example.com" };
    expect(sameOrigin(req({ ...host, origin: "https://pos.example.com" }))).toBe(true);
    expect(sameOrigin(req({ ...host, origin: "http://localhost:3000" }))).toBe(true);
    expect(sameOrigin(req({ ...host, origin: "http://pos.example.com" }))).toBe(false);
    expect(sameOrigin(req({ ...host, origin: "https://pos.example.com.evil.example" }))).toBe(false);
  });

  it("refuses a malformed Origin", () => {
    expect(sameOrigin(req({ origin: "not a url", host: "api.example.com" }))).toBe(false);
  });
});
