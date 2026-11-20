import { describe, expect, it } from "vitest";
import { planAllocations, orderRules, overAllocation, type EngineRule } from "./split-engine";
import { parseMajor, formatMinor, parsePercentToBps, percentOf } from "./money";

const t0 = new Date("2026-01-01T00:00:00Z");
const later = (s: number) => new Date(t0.getTime() + s * 1000);
const fixed = (id: string, priority: number, naira: number, at = t0): EngineRule => ({ id, priority, createdAt: at, method: "FIXED", amountMinor: BigInt(naira) * 100n });
const pct = (id: string, priority: number, bps: number, at = t0): EngineRule => ({ id, priority, createdAt: at, method: "PERCENT", percentBps: bps });
const N = (naira: number) => BigInt(naira) * 100n;

describe("money", () => {
  it("parses and formats without floats", () => {
    expect(parseMajor("50,000.5")).toBe(5000050n);
    expect(parseMajor("₦600000")).toBe(60000000n);
    expect(formatMinor(5000050n)).toBe("₦50,000.50");
    expect(() => parseMajor("1.234")).toThrow();
    expect(() => parseMajor("-5")).toThrow();
  });
  it("parses percentages to basis points", () => {
    expect(parsePercentToBps("15")).toBe(1500);
    expect(parsePercentToBps("33.33")).toBe(3333);
    expect(() => parsePercentToBps("0")).toThrow();
    expect(() => parsePercentToBps("100.01")).toThrow();
  });
  it("rounds percentages down to the kobo", () => {
    expect(percentOf(100n, 3333)).toBe(33n); // 33.33 -> 33
  });
});

describe("split engine", () => {
  it("runs the brief's example: 600k with 10%, 100k, 50k, 200k", () => {
    const rules = [pct("tithe", 1, 1000), fixed("mum", 2, 100_000), fixed("bro", 3, 50_000), fixed("save", 4, 200_000)];
    const plan = planAllocations(rules, N(600_000), N(600_000));
    expect(plan.allocations.map((a) => a.allocatedMinor)).toEqual([N(60_000), N(100_000), N(50_000), N(200_000)]);
    expect(plan.totalAllocated).toBe(N(410_000));
    expect(plan.remaining).toBe(N(190_000));
  });

  it("uses the original amount as the percentage base, not the remainder", () => {
    const plan = planAllocations([fixed("a", 1, 500), pct("b", 2, 5000)], N(1000), N(1000));
    expect(plan.allocations[1].requestedMinor).toBe(N(500)); // 50% of 1000, not of 500
    expect(plan.remaining).toBe(0n);
  });

  it("skips rules that cannot be fully funded and keeps evaluating", () => {
    const plan = planAllocations([fixed("big", 1, 800), fixed("too-big", 2, 300), fixed("small", 3, 100)], N(1000), N(1000));
    expect(plan.allocations.map((a) => a.status)).toEqual(["ALLOCATE", "SKIPPED", "ALLOCATE"]);
    expect(plan.allocations[1]).toMatchObject({ skipReason: "Insufficient funds", requestedMinor: N(300), availableBefore: N(200) });
    expect(plan.remaining).toBe(N(100));
  });

  it("never partially pays a rule", () => {
    const plan = planAllocations([fixed("a", 1, 1001)], N(1000), N(1000));
    expect(plan.allocations[0].allocatedMinor).toBe(0n);
    expect(plan.remaining).toBe(N(1000));
  });

  it("orders by priority, then creation time, then id", () => {
    const ordered = orderRules([fixed("c", 2, 1), fixed("b", 1, 1, later(5)), fixed("a", 1, 1, later(1))]);
    expect(ordered.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("is deterministic regardless of input order", () => {
    const rules = [pct("x", 3, 2500), fixed("y", 1, 300), fixed("z", 2, 400)];
    const a = planAllocations(rules, N(1000), N(1000));
    const b = planAllocations([...rules].reverse(), N(1000), N(1000));
    expect(a).toEqual(b);
  });

  it("conserves money: allocated + remaining === available, for many random cases", () => {
    let seed = 42;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let i = 0; i < 500; i++) {
      const base = BigInt(rand(10_000_000) + 1);
      const available = base - BigInt(rand(Number(base)));
      const rules = Array.from({ length: rand(8) + 1 }, (_, k) =>
        rand(2) ? pct(`p${k}`, rand(10) + 1, rand(10000) + 1) : { ...fixed(`f${k}`, rand(10) + 1, 0), amountMinor: BigInt(rand(5_000_000) + 1) },
      );
      const plan = planAllocations(rules, base, available);
      const sum = plan.allocations.reduce((s, a) => s + a.allocatedMinor, 0n);
      expect(sum).toBe(plan.totalAllocated);
      expect(plan.totalAllocated + plan.remaining).toBe(available);
      expect(plan.remaining >= 0n).toBe(true);
      plan.allocations.forEach((a) => expect(a.allocatedMinor === 0n || a.allocatedMinor === a.requestedMinor).toBe(true));
    }
  });

  it("percentages summing to 100% never exceed the base after rounding", () => {
    const plan = planAllocations([pct("a", 1, 3333), pct("b", 1, 3333), pct("c", 1, 3334)], 100n, 100n);
    expect(plan.totalAllocated <= 100n).toBe(true);
    expect(plan.remaining).toBe(1n);
  });

  it("flags over-allocation at configuration time", () => {
    expect(overAllocation([pct("a", 1, 6000), fixed("b", 2, 500)], N(1000)).over).toBe(true);
    expect(overAllocation([pct("a", 1, 4000), fixed("b", 2, 500)], N(1000)).over).toBe(false);
  });
});
