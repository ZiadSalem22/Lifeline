/**
 * Text-selection suppression for hold-to-drag gestures. Touch browsers
 * (iOS Safari above all) start text selection on a long-press even when the
 * pressed element is user-select:none — WebKit walks to the NEAREST
 * selectable text ("selection creep") and grabs that, popping the magnifier
 * and Copy callout mid-drag. While a gesture is pending we blanket-suppress
 * selection with a body class (see globals.css), and on lift we clear
 * whatever the OS managed to select before we claimed the touch.
 */

const CLASS = 'gesture-no-select';

export function suppressTextSelection(on: boolean): void {
  document.body.classList.toggle(CLASS, on);
}

export function clearTextSelection(): void {
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    /* selection API unavailable */
  }
}
