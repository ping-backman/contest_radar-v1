# Contest Radar v1.0

Static frontend + Google Sheets / Apps Script data source + Cloudflare API Cache Worker. No frontend framework or build step is required.

## Files
- `gas-Code.gs` — paste into the Google Apps Script editor. GAS stays outside GitHub as requested.
- `cloudflare/worker.js` — deploy as a Cloudflare Worker.
- `assets/` and root HTML pages — static website source for private GitHub repository and Netlify testing / Cloudflare Pages production.
- `docs/` — spreadsheet schema, API contract and deployment checklist.

## Important before launch
1. Rotate any secret that appeared in previous video-project code. Do not reuse it.
2. Set a fresh random `API_KEY` in Apps Script Script Properties and set the exact same value as Cloudflare Worker secret `GAS_API_KEY`.
3. Replace `REPLACE_WITH_GOOGLE_SPREADSHEET_ID` in `gas-Code.gs`.
4. Replace `API_BASE` in `assets/js/config.js` with the deployed Worker URL.
5. Replace the privacy notice placeholder and add a real contact method before public launch.
6. Test API failures, expired records, eligibility, mobile layout and official entry links before adding real listings.

## Frontend configuration
Edit `assets/js/config.js` after deploying the Worker. The site is static; private GitHub repository does not make the deployed site or its public API private. Any data sent to a visitor's browser must be treated as public.

## Repository layout guidance
For the private GitHub website repository, include the root HTML files, `_redirects`, `assets/`, `cloudflare/worker.js`, `docs/`, `.gitignore`, and `README.md`. Keep `gas-Code.gs` in the Google Apps Script editor; the standalone source is supplied separately in this package for copying/backup, but should not be deployed with the static frontend. Do not include live API secrets.

## Known v1.0 scope
- Competition details are client-rendered from the API. The page title is updated in JavaScript, but social preview crawlers that do not execute JavaScript may see generic metadata. Before a major social/Pinterest campaign, add a server-rendered metadata layer for individual competition URLs (Cloudflare Pages Function or static prerendering).
- The included privacy page is a placeholder and must be finalized before launch.
- The in-memory rate limiter is best-effort only; it is not a distributed/global counter.
