// The BentoOS logo mark — the same bento-box geometry as the browser-tab
// favicon (lib/pwaIcon.tsx / app/icon.tsx): an emerald tile with one big
// compartment + two stacked, in white. Rendered as inline SVG so it scales
// crisply anywhere and stays pixel-consistent with the favicon. Decorative:
// it always sits beside the "BentoOS" wordmark, so it's aria-hidden.
export function BentoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="10" fill="#0E9F6E" />
      <rect x="9" y="9" width="16" height="30" rx="4" fill="#ffffff" />
      <rect x="28" y="9" width="11" height="13.5" rx="4" fill="#ffffff" />
      <rect x="28" y="25.5" width="11" height="13.5" rx="4" fill="#ffffff" />
    </svg>
  );
}
