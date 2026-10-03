import { z } from "zod";

/** Optional contact details as the console sends them: "" means none. Phones are international (E.164), e.g. +8801711000111. */
export const contactEmail = z.string().trim().max(120).email().or(z.literal("")).transform((v) => v || null);
export const contactPhone = z.string().trim().regex(/^\+[1-9]\d{6,14}$/).or(z.literal("")).transform((v) => v || null);
