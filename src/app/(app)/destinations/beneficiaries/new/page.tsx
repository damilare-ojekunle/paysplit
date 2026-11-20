import { redirect } from "next/navigation";

/** Adding a beneficiary is a pop-up on Destinations (Figma "Add New Beneficiary"). */
export default function NewBeneficiary() {
  redirect("/destinations?tab=beneficiaries&new=1");
}
