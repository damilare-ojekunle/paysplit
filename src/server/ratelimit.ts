import { prisma } from "./db";
import { HttpError } from "./http";

/** Fixed-window limiter backed by Postgres so it holds across serverless instances. */
export async function rateLimit(bucket: string, id: string, limit: number, windowSec: number) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const key = `${bucket}:${id}:${windowStart}`;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date((windowStart + windowSec) * 1000)})
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  if (Number(rows[0].count) > limit) throw new HttpError(429, "Too many attempts. Please wait a moment and try again.");
}
