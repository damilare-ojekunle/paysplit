export const metadata = { title: "Privacy Policy · PaySplit" };
export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>We collect only what we need to run your account: your name, email, phone number, identity verification result, salary account and the destinations and rules you create.</p>
      <h2>Identity data</h2><p>Your BVN or NIN is sent to our verification partner (Dojah) for the check only. We store a masked version (last four digits) and a one-way fingerprint, never the full number. Selfies are not stored by PaySplit.</p>
      <h2>Payments data</h2><p>Payments are processed by Flutterwave. We keep a double-entry record of every movement so your balances are always auditable.</p>
      <h2>Your rights</h2><p>You can download all data we hold about you from Profile &amp; Settings → Your data, and change your notification preferences at any time.</p>
      <h2>Contact</h2><p>support@paysplit.test</p>
    </>
  );
}
