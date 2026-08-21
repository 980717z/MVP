// ─────────────────────────────────────────────────────────────────────────
//  Staff edits to a line on an EXISTING order: quantity, unit price, note.
//  ZERO imports beyond the OrderItem type — pure, unit-tested.
//
//  Why this exists: a QR order arrives with no note, then the diner asks for
//  加料 (extra ingredients) that costs more. Staff need to re-price that one
//  line and tell the kitchen why, after the order was already placed.
//
//  THE adjust CONTRACT (see OrderItem.adjust in lib/orders): `adjust` is the
//  ± delta ALREADY FOLDED INTO `price`, carried separately so the printed bill
//  can annotate the reason line ("加料 +$5.00"). So the invariant is:
//
//      base  = price - adjust        (the pre-adjustment unit price)
//      price = base + adjust
//
//  Deriving `base` on every edit is what makes repeated edits stable: bumping
//  24.99 → 29.99 → 27.99 must end at adjust=+3.00, not +8.00. Recomputing from
//  the delta each time (adjust += change) would drift on the second edit.
// ─────────────────────────────────────────────────────────────────────────

/** Just the fields this module reads/writes; real OrderItems carry more. */
export interface EditableItem {
  price?: number | null;
  qty: number;
  note?: string;
  adjust?: number;
  cancelled?: boolean;
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** The unit price before any staff adjustment — what the menu charged. */
export function basePriceOf(it: EditableItem): number {
  return money((Number(it.price) || 0) - (Number(it.adjust) || 0));
}

/**
 * Apply a staff edit to one line, keeping the base/adjust invariant.
 *
 * Omitted fields are left alone. A blank note clears it. An adjustment of
 * exactly 0 removes the `adjust` key entirely rather than storing 0, so the
 * bill doesn't print a meaningless "+$0.00" reason line.
 */
export function applyItemEdit<T extends EditableItem>(
  it: T,
  patch: { qty?: number; price?: number; note?: string },
): T {
  const next = { ...it } as T;

  if (patch.qty != null && Number.isFinite(patch.qty)) {
    next.qty = Math.max(1, Math.floor(patch.qty)); // never 0 — cancel the line instead
  }

  if (patch.price != null && Number.isFinite(patch.price)) {
    const base = basePriceOf(it);
    const price = money(Math.max(0, patch.price));
    const adjust = money(price - base);
    next.price = price;
    if (adjust === 0) delete (next as EditableItem).adjust;
    else next.adjust = adjust;
  }

  if (patch.note != null) {
    const note = patch.note.trim();
    if (note) next.note = note;
    else delete (next as EditableItem).note;
  }

  return next;
}

/** Order total across non-cancelled lines, rounded to the cent. */
export function activeTotal(items: EditableItem[]): number {
  return money(
    (items ?? [])
      .filter((it) => !it.cancelled)
      .reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),
  );
}
