// ─────────────────────────────────────────────────────────────────────────
//  Sales statistics (销售统计) — PURE aggregation over checkout records, no I/O.
//  Source of truth = table_sessions (dine-in settlements). A split checkout is
//  decomposed via its `splits` so a 分单 correctly attributes its collected money
//  across cash / EMT / card / other.
//
//  Framing (owner's books): pre-tax SALES is the headline. Tax is remitted to the
//  government; tips pass through to staff. They are tracked as SEPARATE lines, never
//  folded into "revenue". Collected = total (sales+tax) + tips = what came in.
// ─────────────────────────────────────────────────────────────────────────

export type Method = "cash" | "card" | "emt" | "other";
export const METHODS: Method[] = ["cash", "card", "emt", "other"];

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const norm = (m: unknown): Method => (m === "cash" || m === "card" || m === "emt" ? m : "other");

export interface StatsSplit { method?: string; total?: number; tip?: number; label?: string }
export interface SessionRow {
  id?: string; // table_sessions PK — used to drill into the settled orders' dishes
  table_no?: string; // dine-in table label (blank for togo/delivery); enables 桌号 sort
  closed_at: string;
  business_date: string;
  payment_method: string; // cash | card | emt | other | split
  subtotal: number;
  gst: number;
  pst: number;
  total: number;
  tip?: number;
  splits?: StatsSplit[];
}

export interface MethodAgg { collected: number; tips: number; txns: number }
export interface SalesAgg {
  txns: number;        // number of table checkouts
  sales: number;       // pre-tax subtotal Σ (the headline 营业额)
  gst: number;
  pst: number;
  hst: number;         // gst + pst (single line)
  tips: number;        // pass-through to staff
  collected: number;   // sales + tax + tips (what actually came in)
  avgTicket: number;   // sales / txns
  byMethod: Record<Method, MethodAgg>;
}

/** Aggregate a set of checkout rows into the sales-stats shape. Splits are
 *  decomposed per payment method; table-level sales/tax/tips stay authoritative. */
export function aggregateSales(rows: SessionRow[]): SalesAgg {
  const byMethod: Record<Method, MethodAgg> = {
    cash: { collected: 0, tips: 0, txns: 0 },
    card: { collected: 0, tips: 0, txns: 0 },
    emt: { collected: 0, tips: 0, txns: 0 },
    other: { collected: 0, tips: 0, txns: 0 },
  };
  let txns = 0, sales = 0, gst = 0, pst = 0, tips = 0, collected = 0;

  for (const r of rows) {
    txns += 1;
    sales += Number(r.subtotal) || 0;
    gst += Number(r.gst) || 0;
    pst += Number(r.pst) || 0;
    const rowTip = Number(r.tip) || 0;
    tips += rowTip;
    collected += (Number(r.total) || 0) + rowTip;

    if (r.payment_method === "split" && Array.isArray(r.splits) && r.splits.length) {
      for (const s of r.splits) {
        const m = norm(s.method);
        const t = Number(s.tip) || 0;
        byMethod[m].collected += (Number(s.total) || 0) + t;
        byMethod[m].tips += t;
        byMethod[m].txns += 1;
      }
    } else {
      const m = norm(r.payment_method);
      byMethod[m].collected += (Number(r.total) || 0) + rowTip;
      byMethod[m].tips += rowTip;
      byMethod[m].txns += 1;
    }
  }

  for (const m of METHODS) {
    byMethod[m].collected = money(byMethod[m].collected);
    byMethod[m].tips = money(byMethod[m].tips);
  }
  return {
    txns,
    sales: money(sales),
    gst: money(gst),
    pst: money(pst),
    hst: money(gst + pst),
    tips: money(tips),
    collected: money(collected),
    avgTicket: txns ? money(sales / txns) : 0,
    byMethod,
  };
}

/** Toronto business date (YYYY-MM-DD) — matches the checkout route's stamping.
 *  dayStartHour shifts the instant back so after-midnight sales (before that
 *  hour) resolve to the previous calendar day. 0 = midnight (unchanged). */
export function torontoToday(now: Date, dayStartHour = 0): string {
  const at = dayStartHour ? new Date(now.getTime() - dayStartHour * 3600_000) : now;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Shift a YYYY-MM-DD date string by n days (UTC-noon anchored to dodge DST). */
export function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
