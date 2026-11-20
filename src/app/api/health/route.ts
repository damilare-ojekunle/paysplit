import { prisma } from "@/server/db";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", db: "ok", time: new Date().toISOString() });
  } catch {
    return json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
