import { afterEach, describe, expect, it, vi } from "vitest";

// SITE reads the env when the module loads, so each case imports a fresh copy.
const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./site");
};
afterEach(() => vi.unstubAllEnvs());

describe("contact links", () => {
  it("carries the topic into the booking notes and the email subject", async () => {
    const s = await load({ NEXT_PUBLIC_DISCOVERY_CALL_URL: "https://cal.com/possible/intro", NEXT_PUBLIC_CONTACT_EMAIL: "sales@example.com" });
    expect(new URL(s.bookingHref("POS-sible Standard plan")!).searchParams.get("notes")).toBe("POS-sible Standard plan");
    expect(s.emailHref("POS-sible Standard plan")).toBe("mailto:sales@example.com?subject=POS-sible%20Standard%20plan");
  });

  it("defaults to the Skorbit Labs address and booking page", async () => {
    const s = await load({});
    expect(s.emailHref("x")).toBe("mailto:hello@skorbit-labs.com?subject=x");
    expect(s.bookingHref("x")).toBe("https://cal.com/asiful-islam-dm/30min?notes=x");
  });

  it("offers nothing it cannot deliver", async () => {
    const s = await load({ NEXT_PUBLIC_DISCOVERY_CALL_URL: "", NEXT_PUBLIC_CONTACT_EMAIL: "" });
    expect(s.bookingHref("x")).toBeNull();
    expect(s.emailHref("x")).toBeNull();
  });

  it("sends Get started to the contact page unless self sign-up is on", async () => {
    expect((await load({ NEXT_PUBLIC_ALLOW_SIGNUP: "false" })).getStarted).toBe("/contact");
    expect((await load({ NEXT_PUBLIC_ALLOW_SIGNUP: "true" })).getStarted).toBe("/signup");
    expect((await load({})).contactHref({ plan: "standard" })).toBe("/contact?plan=standard");
  });
});
