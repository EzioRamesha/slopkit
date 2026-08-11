# PS5-JB preview host (slim JB page)

This tree is a **separate deployment** from production.

| Host | URL | Branch / repo |
|------|-----|----------------|
| Production (unchanged) | https://ezioramesha.github.io/slopkit/ | `EzioRamesha/slopkit` → `main` |
| Preview (this build) | https://ezioramesha.github.io/slopkit-preview/ | `EzioRamesha/slopkit-preview` → `main` |

## What changed vs production

- Jailbreak page (`slopkit/poops.html`): no Google Fonts CDN, no multi-MB background PNGs (CSS gradients only), `--amber` fixed, `inject-fail` retry wiring fixed
- Landing: single hero preload (not three), preview banner, safer Thirukkural DOM updates, CTA cache-bust aligned (`v=25`)
- Removed unused logo/background assets from this preview tree
- `scripts/sync-pldmgr.sh` rejects ELFs larger than 4 MiB

Exploit core (`poops.js` / `core.js` / `main.js` / `offsets/`) is untouched.
