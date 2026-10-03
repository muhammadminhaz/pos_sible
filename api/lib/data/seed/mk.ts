import type { z } from "zod";

/** Parse through the schema so defaults are filled in and the seed can never drift from the types. */
export function mk<S extends z.ZodTypeAny>(schema: S, value: z.input<S>): z.output<S> {
  return schema.parse(value);
}

export const SEED_USER = "user_admin";
export const LOC_RANGO = "loc_rango";
export const LOC_NIPUN = "loc_nipun";
export const WALK_IN = "walk-in";
