import { describe, expect, it } from "vitest";
import { createFormatter } from "./format";

describe("createFormatter", () => {
  const en = createFormatter("en");
  const bn = createFormatter("bn");

  it("formats money with the symbol and precision", () => {
    expect(en.money(1234567.5)).toBe("৳1,234,567.50");
    expect(en.money(-20)).toBe("-৳20.00");
    expect(createFormatter("en", { placement: "after", precision: 0 }).money(1500)).toBe("1,500 ৳");
  });

  it("uses Bangla digits for bn", () => {
    expect(bn.money(1234567.5)).toBe("৳১২,৩৪,৫৬৭.৫০");
    expect(bn.date("2026-09-27")).toBe("২৭-০৯-২০২৬");
  });

  it("formats dates in the business time zone and pattern", () => {
    expect(en.date("2026-09-27T20:30:00Z")).toBe("28-09-2026");
    expect(createFormatter("en", { dateFormat: "mm/dd/yyyy" }).date("2026-09-27")).toBe("09/27/2026");
    expect(en.dateTime("2026-09-27T08:05:00Z")).toBe("27-09-2026 2:05 PM");
    expect(createFormatter("en", { timeFormat: "24" }).time("2026-09-27T08:05:00Z")).toBe("14:05");
  });

  it("formats qty and percent", () => {
    expect(en.qty(2.5)).toBe("2.5");
    expect(en.percent(12.345)).toBe("12.35%");
  });
});

describe("Bangla display details", () => {
  const bn = createFormatter("bn");
  it("uses Bangla for AM/PM", () => {
    expect(bn.time("2026-09-27T08:05:00Z")).toMatch(/অপরাহ্ণ$/);
    expect(bn.time("2026-09-27T01:05:00Z")).toMatch(/পূর্বাহ্ণ$/);
  });
  it("translates common units and leaves others alone", () => {
    expect(bn.unit("Pc(s)")).toBe("পিস");
    expect(bn.unit("Roll")).toBe("Roll");
    expect(createFormatter("en").unit("Pc(s)")).toBe("Pc(s)");
  });
});

describe("zone-less timestamps", () => {
  it("are shown as written, whatever the browser's time zone", () => {
    const en = createFormatter("en", { timeZone: "Asia/Dhaka" });
    expect(en.dateTime("2026-10-03T03:01:00")).toBe("03-10-2026 3:01 AM");
    expect(en.date("2026-10-03")).toBe("03-10-2026");
    expect(en.time("2026-10-03T15:30:00")).toBe("3:30 PM");
  });
});
