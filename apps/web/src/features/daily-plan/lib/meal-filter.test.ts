import { describe, expect, it } from 'vitest';
import { filterMeals, scoreMeal } from './meal-filter';

/** Saved-meal fuzzy search: forgiving substring/token/subsequence matching. */

const meals = [
  { name: 'My usual breakfast' },
  { name: 'Chicken & rice bowl' },
  { name: 'Protein shake + banana' },
  { name: 'Cheeseburger' },
  { name: 'سندوتش مفروم' },
];

describe('scoreMeal', () => {
  it('substring match surfaces "burger" inside "Cheeseburger"', () => {
    expect(scoreMeal('Cheeseburger', 'burger')).toBeGreaterThan(0);
    // A non-substring word must not accidentally win over the real substring.
    expect(scoreMeal('Cheeseburger', 'burger')).toBeGreaterThan(
      scoreMeal('Chicken bowl', 'burger'),
    );
  });

  it('ranks exact > prefix > interior substring', () => {
    expect(scoreMeal('Cheeseburger', 'cheeseburger')).toBeGreaterThan(
      scoreMeal('Cheeseburger', 'cheese'),
    );
    expect(scoreMeal('Cheeseburger', 'cheese')).toBeGreaterThan(
      scoreMeal('Cheeseburger', 'burger'),
    );
  });

  it('multi-token query matches when every token is present, any order', () => {
    expect(scoreMeal('Chicken & rice bowl', 'chicken bowl')).toBeGreaterThan(0);
    expect(scoreMeal('Chicken & rice bowl', 'bowl chicken')).toBeGreaterThan(0);
  });

  it('tolerates typos via subsequence (chikn → chicken)', () => {
    expect(scoreMeal('Chicken & rice bowl', 'chikn')).toBeGreaterThan(0);
  });

  it('is Arabic-aware and diacritic-insensitive', () => {
    expect(scoreMeal('سندوتش مفروم', 'مفروم')).toBeGreaterThan(0);
    expect(scoreMeal('Café latte', 'cafe')).toBeGreaterThan(0);
  });

  it('rejects unrelated queries', () => {
    expect(scoreMeal('Chicken & rice bowl', 'pizza')).toBe(0);
    expect(scoreMeal('My usual breakfast', 'xyz')).toBe(0);
  });

  it('empty query is neutral (matches everything)', () => {
    expect(scoreMeal('anything', '')).toBeGreaterThan(0);
  });
});

describe('filterMeals', () => {
  it('keeps original order and every item when query is blank', () => {
    const out = filterMeals(meals, '  ');
    expect(out.map((m) => m.item.name)).toEqual(meals.map((m) => m.name));
    expect(out.map((m) => m.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('drops non-matches and preserves original indices for the survivors', () => {
    const out = filterMeals(meals, 'burger');
    expect(out).toHaveLength(1);
    expect(out[0]?.item.name).toBe('Cheeseburger');
    expect(out[0]?.index).toBe(3); // still points at the original position
  });

  it('sorts matches best-first', () => {
    const shakes = [
      { name: 'Banana shake' },
      { name: 'Protein shake + banana' },
      { name: 'Shake' },
    ];
    const out = filterMeals(shakes, 'shake');
    expect(out[0]?.item.name).toBe('Shake'); // exact wins
  });
});
