# slopkit-personal

Private PS5-JB host with **host-side payload queue** (add / delete / reorder / delay / auto-toggle).

## Setup

1. Create a fine-grained or classic GitHub PAT with **`repo`** access to this repository.
2. Open the site → **Payload config**.
3. Enter Owner / Repo / Branch / PAT → **Remember for this tab**.
4. Upload ELFs, set order + delay (seconds after each), toggle auto inject → **Save to host**.
5. Wait ~1 minute for GitHub Pages to rebuild, then **Start jailbreak** on the PS5.

Token is kept in `sessionStorage` only (this browser tab). It is never committed.

## Files

- `payloads/queue.json` — auto flag + ordered list + per-item `delayAfterSec`
- `payloads/*.elf` — binaries on the host (repo)
- `ui/payload-config.js` — config modal (GitHub Contents API)

## Notes

- GitHub Pages on a **private** repo needs a paid GitHub plan; otherwise make the repo public but keep the URL private.
- After each Save, Pages must rebuild before the PS5 sees new files.
