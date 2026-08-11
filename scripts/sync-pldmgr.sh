#!/usr/bin/env bash
# Sync payloads/pldmgr.elf from the latest itsPLK/ps5-payload-manager release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/payloads/pldmgr.elf"
REPO="itsPLK/ps5-payload-manager"

echo "[sync-pldmgr] Resolving latest release for ${REPO}..."

if command -v gh >/dev/null 2>&1; then
  TAG="$(gh api "repos/${REPO}/releases/latest" --jq .tag_name)"
  ASSET_URL="$(gh api "repos/${REPO}/releases/latest" \
    --jq '.assets[] | select(.name | test("(?i)pldmgr.*\\.elf$")) | .browser_download_url' \
    | head -n 1)"
else
  JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
  TAG="$(printf '%s' "$JSON" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)"
  ASSET_URL="$(printf '%s' "$JSON" | sed -n 's/.*"browser_download_url": *"\([^"]*pldmgr[^"]*\.elf\)".*/\1/p' | head -n 1)"
fi

if [[ -z "${ASSET_URL:-}" ]]; then
  echo "[sync-pldmgr] ERROR: could not find a pldmgr*.elf asset on the latest release" >&2
  exit 1
fi

echo "[sync-pldmgr] tag=${TAG}"
echo "[sync-pldmgr] url=${ASSET_URL}"
mkdir -p "$ROOT/payloads"
TMP="$(mktemp)"
curl -fsSL -L "$ASSET_URL" -o "$TMP"
# ELF magic: 0x7F E L F
HDR="$(dd if="$TMP" bs=4 count=1 2>/dev/null | LC_ALL=C od -An -tx1 | tr -d ' \n')"
if [[ "$HDR" != "7f454c46" ]]; then
  echo "[sync-pldmgr] ERROR: downloaded file is not an ELF" >&2
  rm -f "$TMP"
  exit 1
fi
mv "$TMP" "$OUT"
BYTES="$(wc -c < "$OUT" | tr -d ' ')"
MAX=$((0x400000))
if (( BYTES > MAX )); then
  echo "[sync-pldmgr] ERROR: ${BYTES} bytes exceeds PAYLOAD_MAX_SIZE (${MAX})" >&2
  rm -f "$OUT"
  exit 1
fi
echo "[sync-pldmgr] wrote ${OUT} (${BYTES} bytes)"
echo "[sync-pldmgr] commit with: git add payloads/pldmgr.elf && git commit -m \"chore(payloads): bump pldmgr to ${TAG}\""
