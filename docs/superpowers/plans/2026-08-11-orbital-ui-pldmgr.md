# Orbital UI + Auto pldmgr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship animated Orbital Telemetry UI across landing + exploit shell, and auto-inject `payloads/pldmgr.elf` after elfldr is ready.

**Architecture:** Keep exploit ladder JS intact in `poops.html` / `poops.js`. Replace presentation layer (CSS + shell markup + small UI hooks). Raise ELF size limit. Add sync script for future pldmgr updates.

**Tech Stack:** Static HTML/CSS/JS, Google Fonts (Orbitron + IBM Plex Mono) with system fallbacks, GitHub Pages.

## Global Constraints

- PS5 WebKit: flex, transforms, opacity; no `backdrop-filter` dependency
- `PAYLOAD_MAX_SIZE` ≥ 4 MiB (`0x400000`)
- Auto-send `pldmgr.elf` to `127.0.0.1:9021` after payload-success path
- Preserve `?go=1&auto=1&trigger=netcontrol&payload=1` arming

---

### Task 1: Add pldmgr binary + sync script

**Files:**
- Create: `payloads/pldmgr.elf` (from v0.5.1)
- Create: `scripts/sync-pldmgr.sh`

- [x] Copy `pldmgr_v0.5.1.elf` → `payloads/pldmgr.elf`
- [ ] Add sync script that downloads latest release asset from `itsPLK/ps5-payload-manager`

### Task 2: Orbital landing page

**Files:**
- Modify: `index.html`

- [ ] Rebuild landing with Orbital palette, reactor accents, INITIATE CTA, motion, reduced-motion support
- [ ] Link to existing armed `poops.html` query string

### Task 3: Orbital exploit shell + auto-inject

**Files:**
- Modify: `slopkit/poops.html`

- [ ] Replace styles with Orbital shell (core, telemetry, drawer)
- [ ] Keep functional IDs (`stage`, `scr`, `payloadMenu`, latch/boot JS)
- [ ] CSS payload tiles including `pldmgr.elf`
- [ ] Set `PAYLOAD_MAX_SIZE = 0x400000`
- [ ] After payload success: show menu + auto `sendPayloadInPlace("pldmgr.elf", …)`
- [ ] Wire stage/success/fail into core visual states

### Task 4: Verify + publish

- [ ] Confirm `pldmgr.elf` size under new limit
- [ ] Smoke-check landing HTML in browser
- [ ] Push to `EzioRamesha/slopkit` when user requests

## Spec coverage

| Spec item | Task |
|-----------|------|
| Landing Orbital UI | 2 |
| Run shell + logs + motion | 3 |
| Auto pldmgr inject | 3 |
| Size limit | 3 |
| Sync script | 1 |
| Secondary payloads | 3 |
