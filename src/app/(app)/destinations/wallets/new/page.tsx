import { redirect } from "next/navigation";

/** Creating a wallet is a pop-up on Destinations (Figma "Create New Wallet"). */
export default function NewWallet() {
  redirect("/destinations?new=1");
}
