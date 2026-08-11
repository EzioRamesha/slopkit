# Orbital UI + Auto pldmgr Design

**Date:** 2026-08-11  
**Status:** Approved — implementation in progress / landing + shell + auto-inject shipped locally  
**Repo:** EzioRamesha/slopkit (GitHub Pages)

## Objective

Redesign the entire slopkit host UI (landing, loading, buttons, logs/status) as an animated “Orbital Telemetry” 2060 diagnostic deck, and after a successful jailbreak automatically inject [PS5 Payload Manager v0.5.1](https://github.com/itsPLK/ps5-payload-manager/releases/tag/v0.5.1) (`pldmgr`) without requiring a manual menu click.

## Constraints

- Target runtime is the **PS5 WebKit browser** (older engine): prefer flexbox, CSS variables, transforms, and opacity. Avoid relying on `backdrop-filter`, heavy SVG filters, or hover-only interaction.
- Hosting is **static GitHub Pages** — no server-side logic.
- Existing exploit ladder in `slopkit/poops.js` / `poops.html` must keep working; UI wraps and drives it, does not rewrite kernel stages.
- Current payload send limit is **2 MiB** (`PAYLOAD_MAX_SIZE = 0x200000`). `pldmgr_v0.5.1.elf` is **~2.3 MiB** and requires raising the limit (e.g. **4 MiB**).

## Decisions

| Topic | Choice |
|-------|--------|
| Visual system | Orbital Telemetry (#1) |
| Motion | High animation + interactive focus states; respect `prefers-reduced-motion` |
| pldmgr source | Ship ELF in repo (`payloads/pldmgr.elf`) — option A |
| Updates | Manual/script: `scripts/sync-pldmgr.sh` pulls latest release asset from itsPLK |
| Auto-inject | After elfldr ready, auto-send `pldmgr.elf` to `127.0.0.1:9021` |
| Secondary payloads | Keep optional quiet secondary tiles (FTP/GDB/etc.) after success — not required for primary path |
| Primary UX images | Replace PNG tile-first UX with CSS/HTML UI |

## Visual system

### Palette

| Token | Hex | Role |
|-------|-----|------|
| `--void` | `#070A0F` | Page background |
| `--panel` | `#0E1520` | Surfaces |
| `--ice` | `#7EE7FF` | Primary accent / focus |
| `--mist` | `#A8B4C4` | Secondary text |
| `--signal` | `#3DFFB5` | Success |
| `--alert` | `#FF5C7A` | Failure |

### Typography

- Display: Orbitron (Google Fonts) with system-ui fallback
- Body / telemetry: IBM Plex Mono (or `ui-monospace`, monospace fallback)

### Signature element

A multi-ring **reactor core** that encodes progress: idle → spinning stages → inject burst → locked ONLINE (or fractured FAIL).

## Screens & interaction

### 1. Landing (`index.html`)

- Full-viewport composition: brand `SLOPKIT` as hero, one supporting line, one CTA.
- Ambient drifting light field + slow scanline drift.
- Brand mark subtle breathe animation.
- Primary control **INITIATE** (replaces RUN): large hit target (≥72px), strong focus ring for PS5 D-pad, charge-ring press feedback, then navigate to armed `poops.html` with existing query params (`go=1&auto=1&trigger=netcontrol&payload=1`).

### 2. Exploit run shell (`poops.html`)

- Hide raw debug chrome by default; show Orbital shell:
  - Reactor core center
  - Stage labels (WebKit → ROP → kernel ladder → elfldr → pldmgr)
  - Telemetry log rail (newest lines highlight, then cool)
- Deep log drawer (collapsible) for full marks / table for power users.
- Stage PASS: ring segment lights + short scale pulse + spark accents.
- Stage FAIL: ring stutters, shifts to `--alert`, clear retry/reboot copy.

### 3. Auto-inject sequence

When current `payloadSuccess` path would open the menu:

1. Mark UI state `INJECTING PLDMGR`
2. Packet-burst animation toward core
3. `sendPayloadToElfldr("pldmgr.elf")`
4. Success → ONLINE badge + shockwave; optional secondary payload list
5. Failure → alert core + RETRY inject control (without re-running whole jailbreak if elfldr still up)

### 4. Responsive / a11y

- TV/PS5: large targets, focus-visible rings, no hover-only actions.
- Desktop: hover glow is additive only.
- `prefers-reduced-motion: reduce`: disable particles/spins; keep color and discrete state changes.

## Technical design

### Files to modify / add

| Path | Change |
|------|--------|
| `index.html` | Orbital landing + INITIATE CTA |
| `slopkit/poops.html` | Orbital shell CSS/JS; auto-inject; raise `PAYLOAD_MAX_SIZE`; menu becomes secondary |
| `payloads/pldmgr.elf` | Copy from local `pldmgr_v0.5.1.elf` (v0.5.1) |
| `scripts/sync-pldmgr.sh` | Fetch latest release asset from `itsPLK/ps5-payload-manager` into `payloads/pldmgr.elf` |
| `docs/...` | This spec + later implementation plan |
| `ui/*.png` | Leave in repo unused by primary UX (no need to delete) |

### Payload plumbing

- Add menu entry / allow-list for `pldmgr.elf` so `payloadIsListed` passes (or relax allow-list for the auto path only — prefer explicit allow-list + optional tile).
- Raise `PAYLOAD_MAX_SIZE` from `0x200000` to at least `0x400000` (4 MiB).
- After `showPayloadMenu()` equivalent success gate, call auto-send once (guard with a session flag to avoid double-send on re-entry).
- Keep `fetch("../payloads/pldmgr.elf")` + TCP send to port **9021** unchanged in mechanism.

### Sync script behavior

```text
scripts/sync-pldmgr.sh
  → resolve latest release via gh api / GitHub API
  → download .elf asset
  → write payloads/pldmgr.elf
  → print version/tag for commit message
```

Operator still commits and pushes (option A). No live download on the PS5.

### Query params

Preserve existing arming/safety params. `payload=1` continues to mean “enable payload path”; behavior becomes **auto pldmgr** (+ optional secondary menu) instead of menu-only.

## Testing strategy

1. Desktop browser: landing animations, focus/keyboard, reduced-motion, drawer toggle.
2. Static serve + open `poops.html?go=1&...` path without PS5: UI states can be dry-run with mocked stage callbacks if needed; at minimum verify CSS/layout.
3. Size gate: confirm `pldmgr.elf` size &lt; new `PAYLOAD_MAX_SIZE` and fetch path 200 on Pages.
4. On PS5 (manual): full jailbreak → auto inject → Payload Manager appears; fail path messaging readable at TV distance.
5. Sync script: dry-run against public itsPLK releases API.

## Out of scope

- Rewriting kernel exploit stages in `poops.js`
- Live CORS fetch of GitHub releases from the PS5 browser
- Native app packaging
- Redesigning binary ELF payloads themselves

## Success criteria

- Landing and run UI feel like one coherent Orbital product, highly animated but usable on PS5.
- Successful elfldr path auto-launches pldmgr with no required click.
- `pldmgr.elf` is updateable via script without changing auto-inject wiring.
- GitHub Pages continues to host the static tree at `https://ezioramesha.github.io/slopkit/`.
