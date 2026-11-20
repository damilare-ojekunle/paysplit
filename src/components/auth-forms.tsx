"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input } from "./ui";
import { Logo } from "./logo";

function useForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  async function run(fn: () => Promise<void>) {
    setLoading(true); setError(null); setFieldErrors({});
    try { await fn(); } catch (e) {
      const err = e as ApiError;
      if (err.issues?.length) setFieldErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      setError(err.message);
    } finally { setLoading(false); }
  }
  return { loading, error, fieldErrors, run, setError };
}

function Password({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label} hint={hint}>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required aria-describedby={hint ? `${id}-hint` : undefined} className="pr-11" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
    </Field>
  );
}

const Head = ({ title, sub }: { title: string; sub: string }) => (
  <div className="mb-8 space-y-2">
    <Logo className="mb-6 lg:hidden" />
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p className="text-sm text-muted">{sub}</p>
  </div>
);

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const f = useForm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); f.run(async () => {
    const r = await api<{ role: string; emailVerified: boolean }>("/api/auth/login", { body: { email, password, admin } });
    router.push(r.role === "ADMIN" ? "/admin" : r.emailVerified ? "/dashboard" : "/verify-email");
    router.refresh();
  }); };
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Head title={admin ? "Admin sign in" : "Welcome back"} sub={admin ? "Restricted to authorised PaySplit administrators." : "Sign in to manage your salary splits."} />
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field id="email" label="Email address"><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
      <Password id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex justify-end"><Link href="/forgot-password" className="text-sm text-brand hover:underline">Forgot password?</Link></div>
      <Button type="submit" size="lg" loading={f.loading}>Sign in</Button>
      {!admin && <p className="text-center text-sm text-muted">New to PaySplit? <Link href="/register" className="text-brand hover:underline">Create an account</Link></p>}
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const f = useForm();
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const rules = [
    { ok: v.password.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(v.password), label: "Uppercase" },
    { ok: /[a-z]/.test(v.password), label: "Lowercase" },
    { ok: /\d/.test(v.password), label: "Number" },
  ];
  const mismatch = v.confirmPassword.length > 0 && v.confirmPassword !== v.password;
  const submit = (e: FormEvent) => { e.preventDefault(); if (mismatch) return f.setError("Passwords do not match"); f.run(async () => { await api("/api/auth/register", { body: v }); router.push("/verify-email"); router.refresh(); }); };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Head title="Create your account" sub="It takes a minute. You'll verify your email next." />
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field id="firstName" label="First name" error={f.fieldErrors.firstName}><Input id="firstName" value={v.firstName} onChange={set("firstName")} autoComplete="given-name" required /></Field>
        <Field id="lastName" label="Last name" error={f.fieldErrors.lastName}><Input id="lastName" value={v.lastName} onChange={set("lastName")} autoComplete="family-name" required /></Field>
      </div>
      <Field id="email" label="Email address" error={f.fieldErrors.email}><Input id="email" type="email" value={v.email} onChange={set("email")} autoComplete="email" required /></Field>
      <Password id="password" label="Password" value={v.password} onChange={(x) => setV({ ...v, password: x })} autoComplete="new-password" />
      <ul className="flex flex-wrap gap-2 text-xs" aria-label="Password requirements">
        {rules.map((r) => <li key={r.label} className={r.ok ? "rounded-full bg-success-50 px-2 py-0.5 text-success" : "rounded-full bg-canvas px-2 py-0.5 text-muted"}>{r.ok ? "✓ " : ""}{r.label}</li>)}
      </ul>
      <Field id="confirmPassword" label="Confirm password" error={mismatch ? "Passwords do not match" : undefined}>
        <Input id="confirmPassword" type="password" value={v.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" required aria-invalid={mismatch} />
      </Field>
      <Button type="submit" size="lg" loading={f.loading} disabled={!rules.every((r) => r.ok)}>Create account</Button>
      <p className="text-center text-sm text-muted">Already have an account? <Link href="/login" className="text-brand hover:underline">Sign in</Link></p>
    </form>
  );
}

export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const f = useForm();
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  if (token) {
    return (
      <div className="space-y-5">
        <Head title="Verify your email" sub="Confirm this is your email address to continue." />
        {f.error && <Alert tone="danger">{f.error}</Alert>}
        {done ? <Alert tone="success">Email verified. Taking you to your dashboard…</Alert> : (
          <Button size="lg" loading={f.loading} onClick={() => f.run(async () => { await api("/api/auth/verify-email", { body: { token } }); setDone(true); setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 900); })}>Verify email</Button>
        )}
        <p className="text-center text-sm text-muted"><Link href="/login" className="text-brand hover:underline">Back to sign in</Link></p>
      </div>
    );
  }
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-50 text-brand"><MailCheck size={28} /></div>
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <p className="text-sm text-muted">We sent a verification link to your email. Open it to continue — it expires in 24 hours.</p>
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      {sent && <Alert tone="success">A new link is on its way.</Alert>}
      <Button variant="secondary" size="lg" loading={f.loading} onClick={() => f.run(async () => { await api("/api/auth/resend-verification", { method: "POST" }); setSent(true); })}>Resend verification email</Button>
      <p className="text-sm text-muted"><Link href="/login" className="text-brand hover:underline">Use a different account</Link></p>
    </div>
  );
}

export function ForgotPassword() {
  const f = useForm();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); f.run(async () => { await api("/api/auth/forgot-password", { body: { email } }); setSent(true); }); }} className="space-y-5" noValidate>
      <Head title="Reset your password" sub="Enter your email and we'll send you a reset link." />
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      {sent ? <Alert tone="success">If an account exists for {email}, a reset link is on its way. It expires in 30 minutes.</Alert> : (
        <>
          <Field id="email" label="Email address"><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
          <Button type="submit" size="lg" loading={f.loading}>Send reset link</Button>
        </>
      )}
      <p className="text-center text-sm text-muted"><Link href="/login" className="text-brand hover:underline">Back to sign in</Link></p>
    </form>
  );
}

export function ResetPassword() {
  const token = useSearchParams().get("token") || "";
  const f = useForm();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); f.run(async () => { await api("/api/auth/reset-password", { body: { token, password, confirmPassword } }); setDone(true); }); }} className="space-y-5" noValidate>
      <Head title="Choose a new password" sub="At least 8 characters with an uppercase letter, a lowercase letter and a number." />
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      {done ? <Alert tone="success">Password updated. You've been signed out everywhere. <Link href="/login" className="underline">Sign in</Link></Alert> : (
        <>
          <Password id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
          <Password id="confirm" label="Confirm new password" value={confirmPassword} onChange={setConfirm} autoComplete="new-password" />
          <Button type="submit" size="lg" loading={f.loading}>Update password</Button>
        </>
      )}
    </form>
  );
}
