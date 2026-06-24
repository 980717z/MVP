import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, range }: { title: string; subtitle?: string; range?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {range && <span className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-400">{range}</span>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? <h2 className="text-sm font-semibold text-slate-700">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

type Tone = "green" | "amber" | "red" | "slate" | "blue";
const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-sky-50 text-sky-700",
};
export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>;
}

export function Kpi({ label, value, delta, tone = "green" }: { label: string; value: string; delta?: string; tone?: "green" | "red" | "slate" }) {
  const dc = tone === "red" ? "text-red-600" : tone === "slate" ? "text-slate-400" : "text-emerald-600";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {delta && <div className={`mt-0.5 text-xs font-medium ${dc}`}>{delta}</div>}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Table({ head, rows, alignRight = [] }: { head: string[]; rows: ReactNode[][]; alignRight?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            {head.map((h, i) => (
              <th key={i} className={`pb-2 font-medium ${alignRight.includes(i) ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-50 last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={`py-2.5 align-middle text-slate-600 ${alignRight.includes(ci) ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AreaTrend({ points, height = 90 }: { points: number[]; height?: number }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const W = 300;
  const H = 100;
  const pad = 8;
  const span = max - min || 1;
  const step = W / (points.length - 1);
  const xy = points.map((p, i) => [i * step, H - pad - ((p - min) / span) * (H - pad * 2)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="demoTrend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#demoTrend)" />
      <polyline points={line} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Bars({ data, height = 130 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-emerald-400 to-sky-400"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 128 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 16;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 40 40" style={{ width: size, height: size }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="6"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 20 20)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-xs text-slate-600">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-700">{s.label}</span>
            <span className="text-slate-400">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function money(n: number) {
  return "$" + n.toLocaleString("en-CA");
}
