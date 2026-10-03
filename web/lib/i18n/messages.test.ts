import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";

function keys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  it("en and bn have the same keys", () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort());
  });
});
