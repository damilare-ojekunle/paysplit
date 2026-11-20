import { Activity, BookOpen, Home, PiggyBank, Plane, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import clsx from "clsx";

const ICONS: Record<string, typeof Wallet> = { Travel: Plane, Vacation: Plane, Emergency: Activity, Investment: TrendingUp, Savings: PiggyBank, Rent: Home, Bills: Receipt, Education: BookOpen, Shopping: ShoppingBag };

/** Figma wallet palette: green, orange, purple, blue — cycled by position. */
export const WALLET_TONES = [
  { solid: "bg-w-green", soft: "from-[#e9fdec] to-[#f6fef7]", text: "text-w-green", hex: "#0f9523" },
  { solid: "bg-w-orange", soft: "from-[#fde9e3] to-[#fef5f2]", text: "text-w-orange", hex: "#fc4f24" },
  { solid: "bg-w-purple", soft: "from-[#efe3fd] to-[#f8f2fe]", text: "text-w-purple", hex: "#8a38f5" },
  { solid: "bg-w-blue", soft: "from-[#e6f4fe] to-[#f4faff]", text: "text-w-blue", hex: "#33a7f5" },
];
export const walletTone = (i: number) => WALLET_TONES[i % WALLET_TONES.length];

export function WalletIcon({ category, index, size = 38 }: { category: string; index: number; size?: number }) {
  const Icon = ICONS[category] ?? Wallet;
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded-[10px] text-white", walletTone(index).solid)} style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.55)} strokeWidth={1.7} />
    </span>
  );
}
