// Structured JSON logs. Redacts obvious PII/secrets — never log raw BVN/NIN, account numbers, tokens.
const REDACT = /(password|token|secret|bvn|nin|selfie|authorization|accountNumber)/i;

function clean(meta: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : v]));
}

function write(level: string, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...clean(meta) }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  info: (m: string, meta?: Record<string, unknown>) => write("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write("error", m, meta),
};
