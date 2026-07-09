// ─────────────────────────────────────────────────────────────────────────
//  库存 FIFO (先进先出) 计价 — 报废/损耗按最早入库的批次顺序扣减成本。
//  Pure so it's unit-testable independent of the stock-loss page's UI state.
// ─────────────────────────────────────────────────────────────────────────

import type { RecordRow } from "./store";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * For each item, walks its rows in date order building a FIFO batch queue
 * from "in" (进货) rows, then deducts scrap (报废) + loss (损耗) from the
 * oldest batch first, row by row. Returns every input row annotated with its
 * FIFO-costed scrapValue/lossValue and the item's remaining onHand quantity
 * (repeated on every row for that item, matching the page's display needs).
 */
export function computeStockLossFifo(rawRows: RecordRow[]): RecordRow[] {
  const byItem: Record<string, RecordRow[]> = {};
  for (const r of rawRows) {
    const item = r.item || "";
    if (item) (byItem[item] ??= []).push(r);
  }

  const valueMap = new Map<string, { scrapValue: number; lossValue: number }>();
  const itemOnHand: Record<string, number> = {};

  for (const [item, itemRows] of Object.entries(byItem)) {
    const sorted = [...itemRows].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const batches: { qty: number; cost: number }[] = [];
    for (const r of sorted) {
      const inQty = parseFloat(r.inQty) || 0;
      if (inQty > 0) batches.push({ qty: inQty, cost: parseFloat(r.unitCost) || 0 });
    }

    let bi = 0;
    for (const r of sorted) {
      const scrap = parseFloat(r.scrapQty) || 0;
      const loss = parseFloat(r.lossQty) || 0;
      let scrapVal = 0;
      let lossVal = 0;

      let toDeduct = scrap;
      while (toDeduct > 0 && bi < batches.length) {
        const take = Math.min(toDeduct, batches[bi].qty);
        scrapVal += take * batches[bi].cost;
        batches[bi].qty -= take;
        toDeduct -= take;
        if (batches[bi].qty <= 0) bi++;
      }

      toDeduct = loss;
      while (toDeduct > 0 && bi < batches.length) {
        const take = Math.min(toDeduct, batches[bi].qty);
        lossVal += take * batches[bi].cost;
        batches[bi].qty -= take;
        toDeduct -= take;
        if (batches[bi].qty <= 0) bi++;
      }

      valueMap.set(r.id, { scrapValue: r2(scrapVal), lossValue: r2(lossVal) });
    }

    const remainQty = batches.slice(bi).reduce((s, b) => s + b.qty, 0);
    itemOnHand[item] = r2(remainQty);
  }

  return rawRows.map((r) => {
    const v = valueMap.get(r.id) ?? { scrapValue: 0, lossValue: 0 };
    const onHand = itemOnHand[r.item || ""] ?? 0;
    return {
      ...r,
      scrapValue: String(v.scrapValue),
      lossValue: String(v.lossValue),
      onHand: String(onHand),
    };
  });
}
