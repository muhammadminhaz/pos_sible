import { roundMoney } from "@/lib/domain/money";

export type Rng = {
  next: () => number;
  int: (a: number, b: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  chance: (p: number) => boolean;
  money: (a: number, b: number) => number;
  shuffle: <T>(arr: readonly T[]) => T[];
};

/** Small, fast, deterministic PRNG. Same seed → same sequence. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (a: number, b: number) => a + Math.floor(next() * (b - a + 1));
  return {
    next,
    int,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    money: (a, b) => roundMoney(a + next() * (b - a), 0),
    shuffle: (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Deterministic ids: `p_0001`, `t_0042`… Services use a different (random) format, so they never collide. */
export function idFactory() {
  const counters = new Map<string, number>();
  return (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(4, "0")}`;
  };
}
export type IdFn = ReturnType<typeof idFactory>;
