import { z } from "zod";
import { requireKycUser } from "@/server/auth";
import { route, body, json } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { executeSplit } from "@/server/money-service";

export const POST = route(async (req) => {
  const user = await requireKycUser();
  await rateLimit("run-now", user.id, 10, 3600);
  const { idempotencyKey } = await body(req, z.object({ idempotencyKey: z.string().min(8).max(64) }));
  const exec = await executeSplit(user.id, { trigger: "MANUAL", idempotencyKey: `manual:${user.id}:${idempotencyKey}` });
  return json({ id: exec.id, status: exec.status });
});
