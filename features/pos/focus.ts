export const SEARCH_ID = "pos-search";

/** Spec § a11y: focus returns to product search after each add, dialog close and checkout. */
export function focusSearch() {
  requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
}
