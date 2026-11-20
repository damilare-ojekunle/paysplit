"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, IdCard, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, LinkButton, Panel, Select } from "@/components/ui";
import { CopyButton } from "@/components/client-bits";

type Init = {
  country: string; phone: string; kycStatus: string; hasProfile: boolean;
  verification: null | { id: string; idType: "BVN" | "NIN"; masked: string; identityOk: boolean; reason: string | null };
  account: null | { status: string; accountNumber: string | null; bankName: string | null; accountName: string | null };
};

const STEPS = ["Profile Basics", "Identity Verification", "Biometrics Liveness"];

export function KycWizard({ initial }: { initial: Init }) {
  const router = useRouter();
  const approved = initial.kycStatus === "APPROVED";
  const startStep = approved ? 3 : !initial.hasProfile ? 0 : initial.verification?.identityOk ? 2 : 1;
  const [step, setStep] = useState(startStep);
  const [country, setCountry] = useState(initial.country);
  const [phone, setPhone] = useState(initial.phone);
  const [idType, setIdType] = useState<"BVN" | "NIN">(initial.verification?.idType ?? "BVN");
  const [idNumber, setIdNumber] = useState("");
  const [verificationId, setVerificationId] = useState(initial.verification?.id ?? "");
  const [error, setError] = useState<string | null>(step === 2 && initial.verification?.reason ? initial.verification.reason : null);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(initial.account);

  async function run(fn: () => Promise<void>) {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as ApiError).message); } finally { setLoading(false); }
  }

  return (
    <Panel className="grid gap-4 sm:-mx-4 lg:min-h-[752px] lg:grid-cols-[490px_1fr]">
      <aside className="kpi-card flex flex-col items-center gap-8 rounded-[20px] px-6 py-8 text-center">
        <KycArt />
        <ol className="space-y-6" aria-label="Verification steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-1.5" aria-current={i === step ? "step" : undefined}>
              {i <= step ? <CheckCircle2 size={22} className={i === step ? "fill-brand text-white" : "text-brand"} aria-hidden /> : <CheckCircle2 size={22} className="text-subtle" aria-hidden />}
              <span className={clsx("text-lg", i === step ? "text-brand" : i < step ? "text-ink" : "text-subtle")}>{s}</span>
            </li>
          ))}
        </ol>
        <p className="max-w-[260px] text-sm text-ink">{["We'll use this number for verification and messages about your account.", "We check your BVN or NIN with Dojah. We never store the full number.", "A quick selfie confirms it's really you, matched against your identity record.", "You're verified. Your salary account is ready."][Math.min(step, 3)]}</p>
      </aside>

      <section className="flex flex-col rounded-[20px] border border-line-2 bg-panel-2 p-2">
        <div className="flex h-11 items-center justify-between px-3 text-sm">
          {step > 0 && step < 3 ? <button onClick={() => { setError(null); setStep(step - 1); }} className="inline-flex items-center gap-1 text-muted hover:text-ink"><ChevronLeft size={16} /> Previous</button> : <span />}
          {step < 3 && <Link href="/dashboard" className="inline-flex items-center gap-1 text-brand hover:underline">Skip step <ChevronRight size={16} /></Link>}
        </div>
        <div className="flex flex-1 justify-center rounded-2xl border border-line bg-white px-5 py-10 sm:px-12">
        <div className="flex w-full max-w-[704px] flex-col">
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        {step === 0 && (
          <form className="flex flex-1 flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/profile", { method: "PATCH", body: { country, phone } }); setStep(1); router.refresh(); }); }}>
            <div><h2 className="text-2xl">Profile Basics</h2><p className="mt-1 text-[15px] text-muted">Select your operating region and default currency for salary processing.</p></div>
            <Field id="country" label="Country"><Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}><option value="NG">Nigeria</option></Select></Field>
            <Field id="phone" label="Mobile Phone Number" hint="e.g. 803 456 7890">
              <div className="flex"><span className="grid h-[52px] place-items-center rounded-l-[10px] border border-r-0 border-line bg-panel-2 px-3.5 text-[15px]">+234</span><Input id="phone" inputMode="tel" autoComplete="tel-national" className="rounded-l-none" value={phone} onChange={(e) => setPhone(e.target.value)} required aria-describedby="phone-hint" /></div>
            </Field>
            <Button type="submit" size="lg" className="mt-auto h-[60px]" loading={loading}>Continue</Button>
          </form>
        )}

        {step === 1 && (
          <form className="flex flex-1 flex-col gap-5" onSubmit={(e) => { e.preventDefault(); run(async () => {
            const r = await api<{ ok: boolean; reason?: string; verificationId: string }>("/api/kyc/identity", { body: { idType, idNumber } });
            if (!r.ok) throw new ApiError(422, r.reason || "We couldn't verify that number");
            setVerificationId(r.verificationId); setStep(2);
          }); }}>
            <div><h2 className="text-2xl">Identity Verification</h2><p className="mt-1 text-[15px] text-muted">Choose one. You don't need to provide both.</p></div>
            <fieldset className="grid grid-cols-2 gap-3">
              <legend className="sr-only">Identity type</legend>
              {(["BVN", "NIN"] as const).map((t) => (
                <label key={t} className={clsx("flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5", idType === t ? "border-brand bg-brand-50" : "border-line")}>
                  <span className={clsx("grid size-10 place-items-center rounded-full", idType === t ? "bg-brand text-white" : "bg-panel text-muted")}>{t === "BVN" ? <Landmark size={18} /> : <IdCard size={18} />}</span>
                  <input type="radio" name="idType" value={t} checked={idType === t} onChange={() => setIdType(t)} className="sr-only" />
                  <span><span className="block font-medium">{t}</span><span className="text-xs text-muted">{t === "BVN" ? "Bank Verification Number" : "National Identification Number"}</span></span>
                </label>
              ))}
            </fieldset>
            <Field id="idNumber" label={idType} hint="11 digits. Sandbox test values: BVN 22222222222 · NIN 70123456789">
              <Input id="idNumber" inputMode="numeric" autoComplete="off" maxLength={11} value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))} required aria-describedby="idNumber-hint" />
            </Field>
            <Button type="submit" size="lg" className="mt-auto h-[60px]" loading={loading} disabled={idNumber.length !== 11}>Continue</Button>
          </form>
        )}

        {step === 2 && (
          <Liveness
            idType={idType} needsId={!idNumber} masked={initial.verification?.masked}
            loading={loading}
            onSubmit={(selfie, id) => run(async () => {
              const r = await api<{ ok: boolean; reason?: string; account: Init["account"] }>("/api/kyc/liveness", { body: { verificationId, idNumber: id || idNumber, selfie } });
              if (!r.ok) throw new ApiError(422, r.reason || "Liveness check failed — please retake");
              setAccount(r.account); setStep(3); router.refresh();
            })}
          />
        )}

        {step === 3 && (
          <div className="space-y-5">
            <ShieldCheck size={48} className="text-success" />
            <h2 className="text-2xl font-medium">You're verified</h2>
            <p className="text-muted">Transfers and automatic splits are unlocked.</p>
            {account?.status === "ACTIVE" ? (
              <div className="space-y-2 rounded-2xl border border-line bg-panel-2 p-5">
                <p className="text-sm text-muted">Your dedicated salary account</p>
                <p className="tabular text-2xl font-semibold">{account.accountNumber}</p>
                <p className="text-sm">{account.bankName} · {account.accountName}</p>
                <CopyButton text={`${account.accountNumber} — ${account.bankName} — ${account.accountName}`} label="Copy details for your employer" />
              </div>
            ) : <Alert tone="warn">Your salary account is still being set up. You can retry from the dashboard.</Alert>}
            <div className="flex gap-3"><LinkButton href="/dashboard" variant="secondary" size="lg" className="h-[60px] flex-1">Go to dashboard</LinkButton><LinkButton href="/destinations/wallets/new" size="lg" className="h-[60px] flex-1">Create a wallet</LinkButton></div>
          </div>
        )}
        </div>
        </div>
      </section>
    </Panel>
  );
}

function KycArt() {
  return (
    <div className="relative h-[110px] w-[96px]" aria-hidden>
      <div className="absolute left-3 top-0 h-[100px] w-[78px] rotate-[-6deg] rounded-xl bg-white/70 shadow-sm" />
      <div className="absolute left-1.5 top-1 flex h-[104px] w-[82px] flex-col items-center rounded-xl bg-gradient-to-b from-white to-[#eef1f4] pt-4 shadow-[0_10px_24px_rgba(23,25,24,0.15)]">
        <span className="size-7 rounded-full bg-gradient-to-b from-[#6a6b69] to-[#343635]" />
        <span className="mt-1 h-4 w-12 rounded-t-full bg-gradient-to-b from-[#6a6b69] to-[#343635]" />
        <span className="mt-2 h-1.5 w-12 rounded bg-[#343635]" /><span className="mt-1 h-1.5 w-10 rounded bg-[#939493]" />
      </div>
    </div>
  );
}

function Liveness({ idType, needsId, masked, loading, onSubmit }: { idType: string; needsId: boolean; masked?: string; loading: boolean; onSubmit: (selfie: string, id: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [id, setId] = useState("");

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  async function startCam() {
    setCamErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      setStream(s);
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
    } catch { setCamErr("We couldn't access your camera. Allow camera access in your browser settings and try again."); }
  }
  function capture() {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setShot(c.toDataURL("image/jpeg", 0.85));
    stream?.getTracks().forEach((t) => t.stop()); setStream(null);
  }

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl">Biometrics Liveness</h2><p className="mt-1 text-muted">Face the camera in good light, remove glasses or hats, and keep your face inside the frame.</p></div>
      {needsId && (
        <Field id="confirmId" label={`Re-enter your ${idType} to continue`} hint={masked ? `Ends in ${masked.slice(-4)}` : undefined}>
          <Input id="confirmId" inputMode="numeric" maxLength={11} value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} aria-describedby="confirmId-hint" />
        </Field>
      )}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ink">
        {shot ? <img src={shot} alt="Your captured selfie" className="size-full object-cover" /> : <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" aria-label="Camera preview" />}
        {!stream && !shot && <div className="absolute inset-0 grid place-items-center"><Button onClick={startCam} variant="secondary"><Camera size={16} /> Start camera</Button></div>}
        {stream && <div className="pointer-events-none absolute inset-[15%_25%] rounded-[50%] border-4 border-white/70" aria-hidden />}
      </div>
      {camErr && <Alert tone="danger">{camErr}</Alert>}
      <div className="flex flex-wrap gap-3">
        {stream && <Button onClick={capture}><Camera size={16} /> Capture</Button>}
        {shot && <Button variant="secondary" onClick={() => { setShot(null); startCam(); }}><RefreshCw size={16} /> Retake</Button>}
        {shot && <Button loading={loading} disabled={needsId && id.length !== 11} onClick={() => onSubmit(shot, id)}>Submit selfie</Button>}
      </div>
      <p className="text-xs text-muted">Your selfie is sent to our verification partner for this check only and is not stored by PaySplit. <Link href="/settings" className="underline">Privacy</Link></p>
    </div>
  );
}
