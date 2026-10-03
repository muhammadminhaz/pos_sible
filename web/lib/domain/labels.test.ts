import { describe, expect, it } from "vitest";
import { expandLabels, labelsPerPage, paginateLabels, rowsPerPage, type LabelSheet } from "./labels";

const sheet = (over: Partial<LabelSheet> = {}): LabelSheet => ({
  isContinuous: false, paperWidth: 8.5, paperHeight: 11, labelWidth: 2, labelHeight: 1, topMargin: 0.3, leftMargin: 0.25,
  rowDistance: 0, colDistance: 0, perRow: 4, perSheet: 40, ...over,
});

describe("rowsPerPage", () => {
  it("fits whole label rows under the top margin", () => {
    expect(rowsPerPage(sheet())).toBe(10);
    expect(rowsPerPage(sheet({ labelHeight: 1.25, topMargin: 0.5 }))).toBe(8);
  });
  it("counts the gap between rows", () => {
    expect(rowsPerPage(sheet({ labelHeight: 1, rowDistance: 0.5, topMargin: 0 }))).toBe(7);
  });
  it("is unlimited on a continuous roll", () => {
    expect(rowsPerPage(sheet({ isContinuous: true }))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("labelsPerPage", () => {
  it("uses the configured count, else columns × rows", () => {
    expect(labelsPerPage(sheet())).toBe(40);
    expect(labelsPerPage(sheet({ perSheet: null }))).toBe(40);
  });
});

describe("expandLabels", () => {
  it("repeats each item by its quantity, in order", () => {
    expect(expandLabels([{ item: "a", qty: 2 }, { item: "b", qty: 1 }])).toEqual(["a", "a", "b"]);
  });
  it("rejects zero, negative and fractional quantities", () => {
    for (const qty of [0, -1, 1.5, Number.NaN]) expect(() => expandLabels([{ item: "a", qty }])).toThrow(RangeError);
  });
});

describe("paginateLabels", () => {
  const labels = Array.from({ length: 95 }, (_, i) => i);
  it("breaks into full sheets plus a remainder", () => {
    const pages = paginateLabels(labels, sheet());
    expect(pages.map((p) => p.length)).toEqual([40, 40, 15]);
  });
  it("exactly one sheet's worth stays on one page", () => {
    expect(paginateLabels(labels.slice(0, 40), sheet())).toHaveLength(1);
    expect(paginateLabels(labels.slice(0, 41), sheet())).toHaveLength(2);
  });
  it("a continuous roll is a single page, and nothing gives no pages", () => {
    expect(paginateLabels(labels, sheet({ isContinuous: true }))).toHaveLength(1);
    expect(paginateLabels([], sheet())).toEqual([]);
  });
});
