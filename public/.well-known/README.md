# Apple Pay domain verification

Drop Clover's Apple Pay domain-association file here, named EXACTLY:

    apple-developer-merchantid-domain-association   (no file extension)

It will be served at:
    https://bentoos.io/.well-known/apple-developer-merchantid-domain-association

## Where to get it
Clover merchant dashboard → Settings → Ecommerce → Apple Pay (domain
verification) → add the domain `bentoos.io` → download the association file
Clover generates → save it here (overwrite nothing else) → commit → deploy.
Then finish "verify domain" in the Clover dashboard.

Google Pay needs NO file — just the wallet button (already wired in
components/CloverPayment.tsx).
