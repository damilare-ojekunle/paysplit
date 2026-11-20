// Pure allocation engine — no I/O, no provider or framework imports.
//
// Business rules (PRD §9.2):
//  - Rules run in ascending priority (1 = highest); ties broken by earlier createdAt, then id.
//  - Percentage rules use the ORIGINAL base amount, not what remains.
//  - Each rule is checked against funds remaining after previous allocations.
//  - A rule that cannot be fully funded is SKIPPED (never partially paid); evaluation continues.
//  - Percentages round DOWN to the kobo, so the sum can never exceed the base.
//  - Whatever is left stays in the salary account.
//  - Rules whose inflow condition doesn't match are skipped with a reason (decided by the caller).
//  - Monthly-target rules are capped at what's left of their target this month.

import { Minor, percentOf } from "./money";

export interface EngineRule {
  id: string;
  priority: number;
  createdAt: Date;
  method: "FIXED" | "PERCENT";
  amountMinor?: Minor | null;
  percentBps?: number | null;
  /** Set when the rule's inflow condition doesn't match this run; the rule is skipped with this reason. */
  skipReason?: string | null;
  /** Monthly-target mode: the most this rule may still receive this month. 0 = target reached. */
  capMinor?: Minor | null;
}

export interface Allocation {
  ruleId: string;
  requestedMinor: Minor;
  allocatedMinor: Minor;
  status: "ALLOCATE" | "SKIPPED";
  skipReason?: string;
  availableBefore: Minor;
}

export interface AllocationPlan {
  allocations: Allocation[];
  totalAllocated: Minor;
  remaining: Minor;
}

export function orderRules<T extends EngineRule>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}

export function requestedAmount(rule: EngineRule, base: Minor): Minor {
  if (rule.method === "FIXED") {
    if (rule.amountMinor == null || rule.amountMinor <= 0n) throw new Error(`Rule ${rule.id}: invalid fixed amount`);
    return rule.amountMinor;
  }
  if (rule.percentBps == null || rule.percentBps < 1 || rule.percentBps > 10000)
    throw new Error(`Rule ${rule.id}: invalid percentage`);
  return percentOf(base, rule.percentBps);
}

/**
 * @param base       percentage base (the confirmed salary amount, or unallocated funds for Run Now)
 * @param available  funds actually available to allocate (≤ salary account balance)
 */
export function planAllocations(rules: EngineRule[], base: Minor, available: Minor): AllocationPlan {
  if (base < 0n || available < 0n) throw new Error("Amounts must be non-negative");
  let remaining = available;
  const allocations: Allocation[] = [];

  for (const rule of orderRules(rules)) {
    if (rule.skipReason) {
      allocations.push({ ruleId: rule.id, requestedMinor: 0n, allocatedMinor: 0n, status: "SKIPPED", skipReason: rule.skipReason, availableBefore: remaining });
      continue;
    }
    let requested = requestedAmount(rule, base);
    if (rule.capMinor != null) {
      if (rule.capMinor <= 0n) {
        allocations.push({ ruleId: rule.id, requestedMinor: 0n, allocatedMinor: 0n, status: "SKIPPED", skipReason: "Monthly target reached", availableBefore: remaining });
        continue;
      }
      if (requested > rule.capMinor) requested = rule.capMinor; // only what's left of this month's target
    }
    if (requested === 0n) {
      allocations.push({ ruleId: rule.id, requestedMinor: 0n, allocatedMinor: 0n, status: "SKIPPED", skipReason: "Amount rounds to zero", availableBefore: remaining });
      continue;
    }
    if (requested > remaining) {
      allocations.push({ ruleId: rule.id, requestedMinor: requested, allocatedMinor: 0n, status: "SKIPPED", skipReason: "Insufficient funds", availableBefore: remaining });
      continue;
    }
    allocations.push({ ruleId: rule.id, requestedMinor: requested, allocatedMinor: requested, status: "ALLOCATE", availableBefore: remaining });
    remaining -= requested;
  }

  const totalAllocated = available - remaining;
  return { allocations, totalAllocated, remaining };
}

/** Configuration-time check: sum of requested amounts against an expected salary. */
export function overAllocation(rules: EngineRule[], expectedBase: Minor): { total: Minor; over: boolean } {
  const total = rules.reduce((s, r) => s + requestedAmount(r, expectedBase), 0n);
  return { total, over: total > expectedBase };
}
