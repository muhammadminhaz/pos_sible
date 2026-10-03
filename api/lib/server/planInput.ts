import { z } from "zod";
import { MODULE_IDS, PERIOD_UNITS } from "./plans";

/** What the platform owner may set on a package. Shared by creating and editing one. */
export const planFields = {
  label: z.string().trim().min(1).max(40),
  maxUsers: z.number().int().min(1).max(100000).nullable(),
  price: z.number().min(0).max(100_000_000),
  periodUnit: z.enum(PERIOD_UNITS),
  periodCount: z.number().int().min(1).max(365),
  modules: z.array(z.enum(MODULE_IDS)).max(MODULE_IDS.length),
  description: z.string().trim().max(200),
  benefits: z.array(z.string().trim().min(1).max(120)).max(12),
};
