import { API_MODE } from "./mode";
import { rpcCall } from "./client";
import { serviceRegistry } from "./registry";

/**
 * Wraps a service object. On the server (and in tests, and in local mode) it is the real thing; in the browser in
 * API mode it is a proxy whose methods call the same method on the server. UI code never knows the difference.
 */
export function service<T extends object>(name: string, impl: T): T {
  if (typeof window === "undefined") serviceRegistry.set(name, impl as Record<string, unknown>);
  if (typeof window === "undefined" || !API_MODE) return impl;
  return new Proxy(impl, {
    get: (_target, method) => (typeof method === "string" ? (...args: unknown[]) => rpcCall(name, method, args) : undefined),
  });
}
