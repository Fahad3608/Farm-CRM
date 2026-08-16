import "server-only";
import { prisma } from "./db";

export type FirstRunState = "needs-setup" | "ready" | "no-database";

/**
 * Is this a brand-new install that still needs an owner account?
 * Distinguishes "no users yet" from "database unreachable" so the UI can
 * tell the difference instead of showing a generic error.
 */
export async function firstRunState(): Promise<FirstRunState> {
  try {
    return (await prisma.user.count()) === 0 ? "needs-setup" : "ready";
  } catch {
    return "no-database";
  }
}
