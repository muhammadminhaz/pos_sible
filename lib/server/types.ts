import type { User } from "@/lib/data/schemas";

/** A user as the browser sees it: never the password. (Type-only, so the browser bundle needs nothing from the server.) */
export type PublicUser = Omit<User, "password">;
