import { verseKey, type VerseRef } from "@/bible/types";
import type { Order, VerseStat } from "@/state/store";

/** How well a verse is known, 0 to 1: its accuracy (smoothed) raised by a streak */
export function mastery(stat: VerseStat | undefined): number {
  if (!stat || stat.attempts === 0) return 0;
  const accuracy = (stat.correct + 1) / (stat.attempts + 2);
  return Math.min(1, accuracy * (1 + Math.min(stat.streak, 5) * 0.08));
}

/**
 * Picks the verse after `current`.
 * - sequential: the next in the selection, wrapping around
 * - shuffle: a random verse not yet asked this round, so each is asked once before any repeats
 * - weakest: a random verse, weighted toward those answered wrong or not yet seen
 */
export function pickNext(
  pool: VerseRef[],
  current: VerseRef | null,
  order: Order,
  asked: Set<string>,
  stats: Record<string, VerseStat>,
  random: () => number = Math.random,
): VerseRef | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;
  const currentKey = current ? verseKey(current) : null;

  if (order === "sequential") {
    const i = currentKey ? pool.findIndex((v) => verseKey(v) === currentKey) : -1;
    return pool[(i + 1) % pool.length]!;
  }

  if (order === "shuffle") {
    let left = pool.filter((v) => !asked.has(verseKey(v)));
    if (left.length === 0) {
      asked.clear();
      left = pool.filter((v) => verseKey(v) !== currentKey);
    }
    const choice = left[Math.floor(random() * left.length)]!;
    asked.add(verseKey(choice));
    return choice;
  }

  const candidates = pool.filter((v) => verseKey(v) !== currentKey);
  const weights = candidates.map((v) => {
    const stat = stats[verseKey(v)];
    const unseen = !stat || stat.attempts === 0 ? 0.6 : 0;
    return (1 - mastery(stat)) ** 2 + unseen + 0.05;
  });
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
