import { describe, expect, it } from "vitest";
import { computeStockLossFifo } from "./inventory";
import type { RecordRow } from "./store";

let seq = 0;
const row = (r: Partial<RecordRow> & { item: string; date: string }): RecordRow => ({
  id: `r${seq++}`,
  createdAt: r.date,
  inQty: "", unitCost: "", scrapQty: "", lossQty: "",
  ...r,
});

describe("computeStockLossFifo", () => {
  it("costs a scrap row against the single batch it came from", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "10", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", scrapQty: "3" }),
    ];
    const out = computeStockLossFifo(rows);
    expect(out[1].scrapValue).toBe("6"); // 3 × $2
    expect(out[1].onHand).toBe("7"); // 10 - 3
  });

  it("splits a deduction across two batches when the first is exactly exhausted", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "5", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", inQty: "5", unitCost: "3" }),
      row({ item: "虾", date: "2026-03-03", scrapQty: "7" }), // 5 @ $2 + 2 @ $3
    ];
    const out = computeStockLossFifo(rows);
    expect(out[2].scrapValue).toBe("16"); // 5*2 + 2*3
    expect(out[2].onHand).toBe("3"); // 10 in - 7 scrapped
  });

  it("a deduction landing exactly on a batch boundary doesn't leak into the next batch", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "5", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", inQty: "5", unitCost: "10" }), // very different cost
      row({ item: "虾", date: "2026-03-03", scrapQty: "5" }), // exactly the first batch
    ];
    const out = computeStockLossFifo(rows);
    expect(out[2].scrapValue).toBe("10"); // must be 5×$2, NOT touching the $10 batch
    expect(out[2].onHand).toBe("5");
  });

  it("scrap and loss on the same row draw from the queue in scrap-then-loss order", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "5", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", inQty: "5", unitCost: "3" }),
      row({ item: "虾", date: "2026-03-03", scrapQty: "4", lossQty: "3" }), // scrap eats 4@$2, loss eats 1@$2 + 2@$3
    ];
    const out = computeStockLossFifo(rows);
    expect(out[2].scrapValue).toBe("8"); // 4 × $2
    expect(out[2].lossValue).toBe("8"); // 1×$2 + 2×$3
    expect(out[2].onHand).toBe("3");
  });

  it("deducting more than total stock stops at zero instead of going negative", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "5", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", scrapQty: "50" }), // way more than the 5 on hand
    ];
    const out = computeStockLossFifo(rows);
    expect(out[1].scrapValue).toBe("10"); // only ever had 5 × $2 to give
    expect(out[1].onHand).toBe("0");
  });

  it("sorts by date before applying FIFO, regardless of input row order", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-03", scrapQty: "5" }), // listed first, but dated last
      row({ item: "虾", date: "2026-03-01", inQty: "5", unitCost: "2" }),
      row({ item: "虾", date: "2026-03-02", inQty: "5", unitCost: "3" }),
    ];
    const out = computeStockLossFifo(rows);
    const scrapRow = out.find((r) => r.scrapQty === "5")!;
    expect(scrapRow.scrapValue).toBe("10"); // still consumes the $2 batch first
  });

  it("keeps different items' batch queues independent", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "10", unitCost: "2" }),
      row({ item: "蟹", date: "2026-03-01", inQty: "10", unitCost: "5" }),
      row({ item: "虾", date: "2026-03-02", scrapQty: "2" }),
      row({ item: "蟹", date: "2026-03-02", scrapQty: "2" }),
    ];
    const out = computeStockLossFifo(rows);
    expect(out.find((r) => r.item === "虾" && r.scrapQty === "2")!.scrapValue).toBe("4"); // 2×$2
    expect(out.find((r) => r.item === "蟹" && r.scrapQty === "2")!.scrapValue).toBe("10"); // 2×$5
  });

  it("rows with no item are passed through untouched (no crash grouping under '')", () => {
    const rows = [row({ item: "", date: "2026-03-01", scrapQty: "1" })];
    const out = computeStockLossFifo(rows);
    expect(out[0].scrapValue).toBe("0");
  });

  it("rounds to cents", () => {
    const rows = [
      row({ item: "虾", date: "2026-03-01", inQty: "3", unitCost: "1.115" }),
      row({ item: "虾", date: "2026-03-02", scrapQty: "3" }),
    ];
    const out = computeStockLossFifo(rows);
    expect(out[1].scrapValue).toBe("3.35"); // 3.345 → 3.35 (banker's-free rounding)
  });
});
