import { destroySession } from "@/server/auth";
import { route, json } from "@/server/http";

export const POST = route(async () => {
  await destroySession();
  return json({ ok: true });
});
