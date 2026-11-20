import { z } from "zod";

// Server-only configuration. Never import this from client components.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  FLW_SECRET_KEY: z.string().optional(),
  FLW_WEBHOOK_HASH: z.string().optional(),
  FLW_SANDBOX_BVN: z.string().default("12345678901"),
  DOJAH_APP_ID: z.string().optional(),
  DOJAH_SECRET_KEY: z.string().optional(),
  DOJAH_BASE_URL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export const env = schema.parse(process.env);
export const appUrl = () => env.APP_URL || "http://localhost:3000";
