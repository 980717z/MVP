export function money(n: number | string | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v === undefined || v === null || isNaN(v as number)) return "—";
  return "$" + (v as number).toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

/** Menu price — keeps cents, e.g. 99.99 → "$99.99", 3 → "$3.00". */
export function price(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v === undefined || v === null || isNaN(v as number)) return "";
  return "$" + (v as number).toFixed(2);
}

export function num(n: number | string | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v === undefined || v === null || isNaN(v as number)) return "—";
  return (v as number).toLocaleString("en-CA", { maximumFractionDigits: 1 });
}

export function sum(rows: any[], key: string): number {
  return rows.reduce((acc, r) => {
    const v = parseFloat(r[key]);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}
