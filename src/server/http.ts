import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { log } from "./log";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

// BigInt-safe JSON (money is bigint; serialised as string minor units).
export function json(data: unknown, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  const raw = await req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  });
  return schema.parse(raw);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler: consistent errors, no stack traces or PII leaked to clients. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) return json({ error: "Validation failed", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
      log.error("unhandled_route_error", { path: new URL(req.url).pathname, err: (e as Error).message });
      return json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
