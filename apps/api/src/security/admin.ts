import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { config } from "../config.js";

export const ADMIN_HEADER = "x-admin-token";

function digest(v: string): Buffer {
  return createHash("sha256").update(v).digest();
}

/**
 * Pure: with no token configured every write is allowed locally, and denied when failClosed
 * (deployed); otherwise the request must carry exactly that token. Hash-then-compare keeps
 * the check constant-time.
 */
export function isAdmin(
  provided: string | undefined | null,
  expected: string | undefined,
  failClosed = false,
): boolean {
  if (!expected) return !failClosed;
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function isAdminRequest(c: Context): boolean {
  if (config.publicWrites) return true;
  return isAdmin(c.req.header(ADMIN_HEADER), config.adminToken, config.adminFailClosed);
}

export function adminDenied(c: Context) {
  return c.json({ error: "Escritura deshabilitada en la demo pública (falta x-admin-token)." }, 401);
}

/** Use on routes that change stored data (agents, context files, saved profiles). */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (!isAdminRequest(c)) return adminDenied(c);
  await next();
};
