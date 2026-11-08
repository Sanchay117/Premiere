#!/usr/bin/env bash
# Releases one build of Premiere on the VM (ship.sh uploads it and runs this as root):
# unpacks it into a folder of its own, installs, builds the site, then points /opt/premiere/current
# at it and restarts both services. The running site keeps serving until that last step, and a
# failed install or build leaves it untouched. Jobs and settings live outside the release folders.
#
#   sudo bash release.sh /tmp/premiere-<commit>.tar.gz
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
tarball=$1
name=$(basename "$tarball" .tar.gz)
rel=/opt/premiere/releases/$name
export PLAYWRIGHT_BROWSERS_PATH=/opt/premiere/browsers
as_premiere() { sudo -u premiere -H env PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" "$@"; }

echo "== Unpack $name"
rm -rf "$rel"
install -d -o premiere -g premiere "$rel"
tar -xzf "$tarball" -C "$rel"
ln -sfn /etc/premiere/premiere.env "$rel/.env"
chown -R premiere:premiere "$rel"
cd "$rel"

echo "== Install"
as_premiere npm ci --no-audit --no-fund
# System libraries Chrome needs (as root), then Chrome and its headless shell for this Playwright.
node_modules/.bin/playwright install-deps chromium
as_premiere node_modules/.bin/playwright install chromium

echo "== Build the site"
# With its runtime settings, since pages built ahead of time bake SITE_URL into link previews.
as_premiere bash -c 'set -a; . /etc/premiere/web.env; set +a; npm run build'

echo "== Switch over"
ln -sfn "$rel" /opt/premiere/current.next
mv -T /opt/premiere/current.next /opt/premiere/current
systemctl restart premiere-worker premiere-web

# Keep the three newest releases, so rolling back is one symlink away.
ls -1dt /opt/premiere/releases/*/ | tail -n +4 | xargs -r rm -rf
rm -f "$tarball"

echo "== Health"
token=$(sed -n 's/^WORKER_TOKEN=//p' /etc/premiere/premiere.env)
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/ 2>/dev/null \
    && curl -fsS -o /dev/null -H "authorization: Bearer $token" http://127.0.0.1:8787/health 2>/dev/null; then break; fi
  sleep 2
done
echo "worker: $(curl -sS -H "authorization: Bearer $token" http://127.0.0.1:8787/health)"
echo "site:   HTTP $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)"
echo "Released $name."
