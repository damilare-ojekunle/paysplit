import { prisma } from "./db";
export async function destinationOptions(userId: string) {
  const [w, b] = await Promise.all([
    prisma.wallet.findMany({ where: { userId, archivedAt: null }, include: { rule: true } }),
    prisma.beneficiary.findMany({ where: { userId, archivedAt: null }, include: { rule: true } }),
  ]);
  return [
    ...w.map((x) => ({ id: x.id, name: x.name, category: x.category, type: "WALLET" as const, hasRule: !!x.rule, ruleId: x.rule?.id })),
    ...b.map((x) => ({ id: x.id, name: x.name, category: x.category, type: "BENEFICIARY" as const, hasRule: !!x.rule, ruleId: x.rule?.id })),
  ];
}
