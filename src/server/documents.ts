import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMinor } from "@/core/money";
import type { TxRow } from "./queries";

// Standard PDF fonts lack the ₦ glyph, so documents use "NGN".
const money = (m: bigint) => formatMinor(m).replace("₦", "NGN ");
const fmtDate = (d: Date) => d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });

export async function receiptPdf(t: TxRow, owner: { name: string; email: string }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 560]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.12, 0.6, 0.94);
  page.drawText("PaySplit", { x: 32, y: 510, size: 20, font: bold, color: blue });
  page.drawText("Transaction receipt", { x: 32, y: 488, size: 11, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(money(t.amountMinor), { x: 32, y: 440, size: 26, font: bold });
  page.drawText(t.status, { x: 32, y: 418, size: 11, font: bold, color: t.status === "SUCCESS" ? rgb(0.1, 0.6, 0.3) : rgb(0.8, 0.3, 0.2) });
  const rows: [string, string][] = [
    ["Reference", t.reference], ["Type", t.label], ["Date", fmtDate(t.createdAt)], ["From", t.source], ["To", t.destination],
    ["Category", t.category], ["Description", t.description], ["Provider ref", t.providerRef || "—"], ["Account holder", `${owner.name} (${owner.email})`],
  ];
  let y = 380;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 32, y, size: 10, font, color: rgb(0.4, 0.45, 0.5) });
    page.drawText(String(v).slice(0, 48), { x: 140, y, size: 10, font });
    y -= 24;
  }
  page.drawText(`Generated ${fmtDate(new Date())}. Sandbox / test mode — no real funds moved.`, { x: 32, y: 40, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  return pdf.save();
}

export interface Statement {
  owner: { name: string; email: string };
  from: Date;
  to: Date;
  opening: bigint;
  closing: bigint;
  totalIn: bigint;
  totalOut: bigint;
  rows: (TxRow & { effect: bigint; running: bigint })[];
}

export function statementCsv(s: Statement) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ["Date", "Reference", "Type", "Description", "From", "To", "Status", "Amount (NGN)", "Effect on total (NGN)", "Running total (NGN)"];
  const n = (m: bigint) => (Number(m) / 100).toFixed(2);
  const lines = s.rows.map((r) => [r.createdAt.toISOString(), r.reference, r.label, r.description, r.source, r.destination, r.status, n(r.amountMinor), n(r.effect), n(r.running)].map((x) => esc(String(x))).join(","));
  return [
    `# PaySplit statement for ${s.owner.name}, ${s.from.toISOString().slice(0, 10)} to ${s.to.toISOString().slice(0, 10)}`,
    `# Opening balance,${n(s.opening)},Total in,${n(s.totalIn)},Total out,${n(s.totalOut)},Closing balance,${n(s.closing)}`,
    head.join(","),
    ...lines,
  ].join("\n");
}

export async function statementPdf(s: Statement) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([842, 595]);
  let y = 550;
  const line = (cols: string[], f = font) => {
    const xs = [30, 140, 270, 380, 560, 650, 740];
    cols.forEach((c, i) => page.drawText(c.slice(0, i === 3 ? 36 : 22), { x: xs[i], y, size: 9, font: f }));
    y -= 16;
    if (y < 40) { page = pdf.addPage([842, 595]); y = 550; }
  };
  page.drawText("PaySplit account statement", { x: 30, y, size: 16, font: bold, color: rgb(0.12, 0.6, 0.94) }); y -= 22;
  page.drawText(`${s.owner.name} · ${s.from.toDateString()} – ${s.to.toDateString()}`, { x: 30, y, size: 10, font }); y -= 18;
  page.drawText(`Opening ${money(s.opening)}   In ${money(s.totalIn)}   Out ${money(s.totalOut)}   Closing ${money(s.closing)}`, { x: 30, y, size: 10, font: bold }); y -= 26;
  line(["Date", "Reference", "Type", "Description", "Status", "Amount", "Running total"], bold);
  for (const r of s.rows) line([fmtDate(r.createdAt), r.reference, r.label, r.description, r.status, money(r.amountMinor), money(r.running)]);
  return pdf.save();
}
