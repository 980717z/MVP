# BentoOS

Next.js 16 + React 19 + Supabase, deployed on Vercel. Multi-tenant back-office for
small merchants, plus per-restaurant customer-facing QR menus.

## Design System
The customer menu for 富来小厨 / Sang's Seafood has a design system in **DESIGN.md**.
Always read DESIGN.md before making visual or UI decisions on the menu/storefront
(`app/menu/[tenant]`). Font choices, colors, spacing, and aesthetic direction are
defined there — do not deviate without explicit user approval. In QA/design review,
flag any menu code that doesn't match DESIGN.md.

Note: the BentoOS platform UI (landing, pricing, demo, dashboard) is a separate brand
with its own pastel/emerald look and its own EN/FR/中 i18n; DESIGN.md governs the
restaurant menu surface specifically.
