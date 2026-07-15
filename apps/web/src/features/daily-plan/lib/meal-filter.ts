/**
 * Fuzzy filtering for the Add Food popup's saved-meal search. Deliberately
 * forgiving: the field doubles as the manual food-name input, so as the user
 * types it should surface anything plausibly related, not only exact-word
 * hits. "burger" must find "Cheeseburger" (substring), "chicken bowl" must
 * find "Chicken & rice bowl" (all tokens present), and "chikn" should still
 * reach "chicken" (subsequence, for typos). Works for Arabic names too —
 * NFD strips Latin accents and Arabic harakat before matching.
 */

/** Combining marks: Latin diacritics (U+0300–036F) + Arabic harakat (U+064B–0652). */
const COMBINING_MARKS = /[\u0300-\u036f\u064b-\u0652]/g;
/** Anything that isn't a letter or number becomes a word gap. */
const NON_WORD = /[^\p{L}\p{N}]+/gu;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .trim();
}

/** True when every char of `query` appears in `text` in order (gaps allowed). */
function isSubsequence(query: string, text: string): boolean {
  if (query.length === 0) return true;
  let qi = 0;
  for (const ch of text) {
    if (ch === query[qi]) qi += 1;
    if (qi === query.length) return true;
  }
  return false;
}

/**
 * 0 = no match. Higher = closer. An empty query returns a neutral 1 so the
 * unfiltered list keeps its natural order.
 */
export function scoreMeal(name: string, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const n = normalize(name);
  if (!n) return 0;

  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 80; // "burger" inside "cheeseburger"

  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => n.includes(token))) return 70;

  const compactQ = q.replace(/ /g, '');
  const compactN = n.replace(/ /g, '');
  if (compactN.includes(compactQ)) return 60; // ignores spacing/punctuation

  // Subsequence is the loosest tier — gate it to 3+ chars so a stray letter
  // doesn't fuzzily match the whole list.
  if (compactQ.length >= 3 && isSubsequence(compactQ, compactN)) return 40;

  return 0;
}

export interface MealMatch<T> {
  item: T;
  /** Position in the ORIGINAL list — callers edit/pin/delete presets by it. */
  index: number;
  score: number;
}

/**
 * Rank meals against a query. With no query the original order is preserved
 * (every item kept); with a query, non-matches are dropped and matches sort
 * best-first, ties broken by original position (stable).
 */
export function filterMeals<T extends { name: string }>(
  meals: readonly T[],
  query: string,
): MealMatch<T>[] {
  const scored = meals.map((item, index) => ({
    item,
    index,
    score: scoreMeal(item.name, query),
  }));
  if (!query.trim()) return scored;
  return scored
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
