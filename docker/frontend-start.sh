#!/bin/sh
# Writes the closable banner shown on top of the app (see frontend/src/Banner.tsx) from the
# BANNER_MESSAGE env var (empty: no banner), then serves the static build. No rebuild needed.
# JSON.stringify escapes the message.
node -e 'process.stdout.write("window.BANNER_MESSAGE = " + JSON.stringify(process.env.BANNER_MESSAGE || "") + ";\n")' > dist/maintenance.js
exec serve -s dist -l 4000
