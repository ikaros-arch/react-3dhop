#!/bin/sh
# Install dependencies inside the container without disturbing the committed lockfile.
#
# `npm ci` is the obvious choice and does not work here: npm resolves the optional wasm fallback
# bindings (@emnapi/*) differently on Linux and on Windows, so a lockfile written by one platform
# is "out of sync" for the other and `npm ci` refuses it. Whichever platform installs last would
# rewrite the file, and the other would rewrite it straight back.
#
# So: install normally — which still honours the pinned versions — then put the lockfile back.
# The host stays the one place the lockfile is generated. After changing dependencies, run
# `npm install` on the host and commit the result.
set -e

cp package-lock.json /tmp/package-lock.json
npm install --no-audit --no-fund
cp /tmp/package-lock.json package-lock.json
