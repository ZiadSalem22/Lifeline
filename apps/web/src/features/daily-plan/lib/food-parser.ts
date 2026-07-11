import type { ChatFood, MealSlot } from '@lifeline/shared';

/**
 * Demo nutrition "AI" (per the design handoff): a small regex food database
 * with Arabic aliases and quantity detection. Production would call a real
 * model; this parser keeps the food-log chat fully offline.
 */

type FoodEntry = [RegExp, string, number, number, number, number]; // regex, name, cal, p, c, f

const FOOD_DB: FoodEntry[] = [
  [/eggs?/, 'egg', 78, 6, 0.6, 5],
  [/toast|bread/, 'toast', 80, 3, 15, 1],
  [/oats?|oatmeal/, 'oats', 150, 5, 27, 3],
  [/banana/, 'banana', 105, 1, 27, 0.4],
  [/apple/, 'apple', 95, 0.5, 25, 0.3],
  [/dates?|تمر/, 'dates', 66, 0.4, 18, 0],
  [/chicken|دجاج/, 'chicken breast', 220, 40, 0, 5],
  [/rice|رز|أرز/, 'rice', 200, 4, 45, 0.5],
  [/salmon|سلمون/, 'salmon', 230, 25, 0, 14],
  [/beef|لحم/, 'beef', 250, 26, 0, 16],
  [/tuna|تونة/, 'tuna', 130, 28, 0, 1],
  [/yogurt|زبادي/, 'greek yogurt', 130, 17, 8, 4],
  [/milk|حليب/, 'milk', 120, 8, 12, 5],
  [/cheese|جبن/, 'cheese', 110, 7, 1, 9],
  [/salad|سلطة/, 'salad', 60, 2, 8, 2],
  [/potato|بطاطس/, 'potato', 160, 4, 37, 0.2],
  [/pasta|معكرونة/, 'pasta', 220, 8, 43, 1.3],
  [/shawarma|شاورما/, 'shawarma', 450, 30, 40, 18],
  [/falafel|فلافل/, 'falafel', 330, 13, 31, 18],
  [/hummus|حمص/, 'hummus', 170, 8, 14, 10],
  [/protein shake|بروتين|whey/, 'protein shake', 150, 30, 5, 2],
  [/almonds?|لوز/, 'almonds', 165, 6, 6, 14],
  [/burger|برجر/, 'burger', 550, 28, 45, 28],
  [/pizza|بيتزا/, 'pizza slice', 285, 12, 36, 10],
];

/** "2 eggs and toast" → [{name:'2× egg', …}, {name:'toast', …}]. */
export function parseFood(text: string): ChatFood[] {
  const found: ChatFood[] = [];
  const lower = text.toLowerCase();
  for (const [re, name, cal, p, c, f] of FOOD_DB) {
    if (!re.test(lower)) continue;
    let qty = 1;
    // Quantity must sit at most one word before the food ("2 scrambled eggs"
    // → 2, but "2 eggs and toast" must NOT leak the 2 onto toast).
    const qm = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?(?:\\w+\\s)?${re.source}`));
    if (qm) qty = Math.min(20, Number.parseFloat(qm[1] ?? '1') || 1);
    found.push({
      name: `${qty !== 1 ? `${qty}× ` : ''}${name}`,
      cal: cal * qty,
      p: p * qty,
      c: c * qty,
      f: f * qty,
    });
  }
  return found;
}

/** Time-of-day meal slot: <11 breakfast, 11–15 lunch, 16–20 dinner, else snacks. */
export function guessSlot(hour: number): MealSlot {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

/** Explicit meal mention (incl. Arabic) wins; otherwise the time-of-day slot. */
export function detectMeal(text: string, hour: number): MealSlot {
  const l = text.toLowerCase();
  if (/breakfast|فطور|صبح|morning/.test(l)) return 'breakfast';
  if (/lunch|غداء|noon/.test(l)) return 'lunch';
  if (/dinner|عشاء|evening|tonight/.test(l)) return 'dinner';
  if (/snack|سناك/.test(l)) return 'snacks';
  return guessSlot(hour);
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Chat summary line for a logged set of foods. */
export function logSummary(foods: ChatFood[], slot: MealSlot): string {
  const cal = Math.round(foods.reduce((a, x) => a + x.cal, 0));
  const p = round1(foods.reduce((a, x) => a + x.p, 0));
  const label = slot.charAt(0).toUpperCase() + slot.slice(1);
  return `${foods.map((x) => x.name).join(', ')} → ${label} ✓\n+${cal} kcal · +${p}g protein`;
}

/** Canned photo analysis (the demo has no vision model). */
export function photoFoods(): ChatFood[] {
  return [
    { name: 'grilled chicken', cal: 280, p: 42, c: 0, f: 8 },
    { name: 'rice', cal: 210, p: 4, c: 46, f: 1 },
    { name: 'side salad', cal: 45, p: 1, c: 6, f: 2 },
  ];
}
