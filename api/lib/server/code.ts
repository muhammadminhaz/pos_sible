import { z } from "zod";

/** What staff type to say which business they belong to: lowercase letters, digits, dot, dash, underscore. */
export const businessCode = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, "bad_code");

/** The code a business gets when none is chosen: its owner's username. */
export const defaultCode = (username: string) => username.trim().toLowerCase();
