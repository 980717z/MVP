# Epson TM-T88VI — Server Direct Print setup

The printer PULLS tickets from BentoOS (it polls a URL every few seconds and
prints whatever XML we return). No cloud account, no push, no local PC.

Endpoint: `https://bentoos.io/api/epson?slug=<shop-slug>`  (e.g. `?slug=fulai`)

## 1. One-time DB migration
Run `supabase/epson-print.sql` in Supabase Studio (adds `orders.printed_at`).
Until this runs, the endpoint just returns "nothing to print" (no errors).

## 2. Put the printer on the shop wifi + find its IP
- Plug in the TM-T88VI, load an 80mm roll.
- Connect it to the restaurant network (Ethernet cable to the router is most
  reliable; wifi models also work). 
- Print a status sheet: hold the **Feed** button while powering on → it prints
  the printer's **IP address**.

## 3. Enable Server Direct Print (printer web console)
- On a computer/phone on the same wifi, open `http://<printer-ip>/` in a browser.
- Log in (default user `epson`, password on the label or `epson`).
- Go to **Configuration → Server Direct Print** (or "Web Service Settings"):
  - **Enable**: ON
  - **URL 1**: `https://bentoos.io/api/epson?slug=fulai&key=<EPSON_PRINT_KEY>`
    (set EPSON_PRINT_KEY in Vercel env — any long random string; it stops strangers
    from polling the endpoint and stealing tickets)
  - **Interval**: 5 seconds (3–10 is fine)
  - **ID / Name**: anything (e.g. `kitchen`)
- Save + reboot the printer.

## 4. Test
- Place a dine-in order from the QR menu (or 出单样张 in the back office to eyeball
  the layout first).
- Within a few seconds the ticket prints, big-font, and cuts.
- Toggle auto-print off anytime: set `tenants.print_enabled = false`.
- Re-print a specific order: the **重打** button on its card (clears its printed
  flag → prints on the next poll).

## Notes / verification
- Chinese prints via `lang="zh-hans"` (the TM-T88VI multibyte font). If Chinese
  shows as boxes, the unit may need the Simplified-Chinese font/code page enabled
  in the printer console (Font settings).
- Fonts sized width/height 2–3 for chef legibility; matches the on-screen preview
  (components/KitchenTicket.tsx).
- Marking is optimistic (a ticket is marked printed when handed to the printer);
  if a print is ever lost, use 重打.
- Security: the endpoint is keyed only by `?slug=`. Order contents aren't highly
  sensitive and the URL only lives in the printer config, but if you want it
  locked down later, add a per-shop token check.
- The old 芯烨云 (Xprinter) path (`/api/print`, `lib/xpyun.ts`) is no longer called
  and can be deleted once the Epson is confirmed working.
