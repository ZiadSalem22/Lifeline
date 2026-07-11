/**
 * Masonry row-span math (design handoff): the grid uses
 * `grid-auto-rows: 8px`, so a card spanning its measured height must cover
 * `ceil((height + gap) / (8 + gap))` rows.
 */
export const MASONRY_ROW_PX = 8;

export function masonryRowSpan(heightPx: number, gapPx: number): number {
  return Math.max(1, Math.ceil((heightPx + gapPx) / (MASONRY_ROW_PX + gapPx)));
}
