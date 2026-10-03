import { beforeEach, describe, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { commit, resetDB } from "@/lib/data/store/db";
import { registersService } from "@/lib/data/services/registers";
import { fuzz } from "./fuzzCore";

const seed = createSeed({ seed: 7, today: "2026-09-28" });

describe("workflow fuzz: random user actions never corrupt the books", () => {
  beforeEach(async () => {
    resetDB(structuredClone(seed));
    useSession.setState({ userId: "user_admin" });
    commit((d) => {
      d.settings.business.transactionEditDays = 0; // allow editing seeded history
      for (const r of d.cashRegisters) if (r.status === "open") Object.assign(r, { status: "close", closedAt: r.openedAt });
    });
    await registersService.open("loc_rango", 1000);
  });

  for (const seedNo of [1, 2, 3, 4, 5]) {
    it(`seed ${seedNo}: 200 random operations`, () => fuzz(seedNo, 200, (fn) => fn()), 120_000);
  }
});
