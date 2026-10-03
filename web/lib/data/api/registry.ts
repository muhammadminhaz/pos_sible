/** Server only: the real service implementations, by name. Filled in as each service module is loaded. */
export const serviceRegistry = new Map<string, Record<string, unknown>>();
