#!/usr/bin/env bash
# Install the shared libraries Playwright's Chromium needs, without root.
#
# Why this exists: `npx playwright install-deps` requires sudo and, on Ubuntu
# 25.10+/26.04, refuses outright with "Playwright does not support <distro>".
# But Chromium only misses four libraries, and they can be unpacked from the
# ordinary Ubuntu .debs into a user-local prefix. playwright.config.ts points
# the browser process at that prefix via LD_LIBRARY_PATH when it exists.
#
# Usage:  ./scripts/install-browser-deps.sh
# Then:   npx playwright install chromium && npm run test:e2e
#
# Safe to re-run. Touches nothing outside $PREFIX and a temp directory.

set -euo pipefail

PREFIX="${PW_LIBS_PREFIX:-$HOME/.local/pw-libs}"
PACKAGES=(libnss3 libnspr4 libasound2t64)

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script is for Debian/Ubuntu (needs apt-get). On other distros," >&2
  echo "install the equivalents of: ${PACKAGES[*]}" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading: ${PACKAGES[*]}"
( cd "$tmp" && apt-get download "${PACKAGES[@]}" )

echo "Unpacking into $PREFIX"
mkdir -p "$PREFIX"
for deb in "$tmp"/*.deb; do
  dpkg -x "$deb" "$PREFIX"
done

libdir="$PREFIX/usr/lib/x86_64-linux-gnu"
missing=0
for lib in libnspr4.so libnss3.so libnssutil3.so libasound.so.2; do
  if [ ! -e "$libdir/$lib" ]; then
    echo "  MISSING after unpack: $lib" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Some libraries are still missing - see above." >&2
  exit 1
fi

echo "Done. Libraries are in $libdir"
echo "playwright.config.ts picks this up automatically; nothing to add to your shell."

# Prove the browser actually starts, rather than only that files landed.
shell_bin="$(find "$HOME/.cache/ms-playwright" -name chrome-headless-shell -type f 2>/dev/null | head -1)"
if [ -n "$shell_bin" ]; then
  if LD_LIBRARY_PATH="$libdir:${LD_LIBRARY_PATH:-}" \
     "$shell_bin" --headless --no-sandbox --dump-dom "data:text/html,<h1>ok</h1>" >/dev/null 2>&1; then
    echo "Verified: Chromium launches and renders."
  else
    echo "Chromium still fails to launch. Run 'ldd \"$shell_bin\" | grep \"not found\"'." >&2
    exit 1
  fi
else
  echo "No Chromium found yet - run 'npx playwright install chromium', then re-run this script to verify."
fi
