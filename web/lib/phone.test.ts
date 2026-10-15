import { describe, expect, it } from "vitest";
import { telHref, waHref } from "./phone";

describe("phone links", () => {
  it("turns a local Bangladeshi mobile into wa.me and tel links", () => {
    expect(waHref("01711000111", "Hi")).toBe("https://wa.me/8801711000111?text=Hi");
    expect(waHref("+880 1711-000111", "Hi")).toBe("https://wa.me/8801711000111?text=Hi");
    expect(telHref("01711000111")).toBe("tel:+8801711000111");
  });
  it("keeps the message intact, Bangla and spaces included", () => {
    const text = "হাই Rahim, we miss you!";
    expect(decodeURIComponent(waHref("01711000111", text)!.split("?text=")[1])).toBe(text);
  });
  it("gives no link for a missing or junk number", () => {
    for (const raw of ["", "   ", "abc"]) {
      expect(telHref(raw)).toBeNull();
      expect(waHref(raw, "Hi")).toBeNull();
    }
  });
});
