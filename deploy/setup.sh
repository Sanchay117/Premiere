#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VM for Premiere: Node, Caddy, a service user, swap, the
# settings files and both systemd services. Safe to run again; rerun it to change the site's address.
#
#   sudo bash setup.sh premiere.example.xyz [another.host ...]
#
# The first host is the site's public address (PUBLIC_URL, SITE_URL); Caddy serves every host
# over HTTPS. After a change of address, release again (deploy/ship.sh) so the site rebuilds.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run as root: sudo bash $0 <host> [host ...]" >&2; exit 1; fi
if [[ $# -lt 1 ]]; then echo "Usage: sudo bash $0 <host> [host ...]" >&2; exit 1; fi

here=$(cd "$(dirname "$0")" && pwd)
hosts=("$@")
primary="https://${hosts[0]}"
NODE_MAJOR=${NODE_MAJOR:-26}
export DEBIAN_FRONTEND=noninteractive

echo "== System packages"
apt-get update -q
apt-get install -yq ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt 22 ]]; then
  echo "== Node $NODE_MAJOR (NodeSource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -yq nodejs
fi
node --version

if ! command -v caddy >/dev/null; then
  echo "== Caddy (official apt repository)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi
caddy version

echo "== Swap (4 GB), so a build or a busy render never meets the out-of-memory killer"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Service user and folders"
id premiere >/dev/null 2>&1 || useradd --system --home-dir /var/lib/premiere --create-home --shell /usr/sbin/nologin premiere
install -d -o premiere -g premiere -m 750 /var/lib/premiere /var/lib/premiere/data
install -d -o premiere -g premiere -m 755 /opt/premiere /opt/premiere/releases /opt/premiere/browsers
install -d -o root -g premiere -m 750 /etc/premiere

echo "== Settings"
# The worker reads /etc/premiere/premiere.env (each release links it in as .env, so the npm
# scripts find it too). The site only gets web.env: the worker's address, its token and the
# public address, never an API key. Both are readable by root and the premiere user only.
worker_env=/etc/premiere/premiere.env
web_env=/etc/premiere/web.env
if [[ ! -f $worker_env ]]; then
  token=$(openssl rand -hex 32)
  cat > "$worker_env" <<EOF
# Premiere worker settings on this VM. Every setting is explained in .env.example in the repo.
# Edit with: sudo nano /etc/premiere/premiere.env
# Then apply with: sudo systemctl restart premiere-worker
# Never paste these keys into a chat.

# Claude API key from Premiere's own Console workspace (the one with the monthly spend limit)
PREMIERE_ANTHROPIC_API_KEY=
# Deepgram key for the narrator
DEEPGRAM_KEY=
# App-side monthly cap in USD; keep it at or below the Console workspace limit
PLANNER_MONTHLY_BUDGET_USD=5

# Free for everyone until Vibeathon 02 ends (16 Nov); see .env.example before switching on
PAYMENTS=off
PAYMENT_ADDRESS=

PUBLIC_URL=$primary
PREMIERE_DATA_DIR=/var/lib/premiere/data
WORKER_HOST=127.0.0.1
WORKER_PORT=8787
WORKER_TOKEN=$token
# One job at a time on 4 vCPUs
JOB_CONCURRENCY=1
EOF
  cat > "$web_env" <<EOF
# Premiere site settings on this VM: where to reach the worker, and the public address.
WORKER_URL=http://127.0.0.1:8787
WORKER_TOKEN=$token
SITE_URL=$primary
EOF
else
  sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=$primary|" "$worker_env"
  sed -i "s|^SITE_URL=.*|SITE_URL=$primary|" "$web_env"
fi
chown root:premiere "$worker_env" "$web_env"
chmod 640 "$worker_env" "$web_env"

echo "== Caddy site: ${hosts[*]}"
site_hosts=$(IFS=,; echo "${hosts[*]}" | sed 's/,/, /g')
sed "s|SITE_HOSTS|$site_hosts|" "$here/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

echo "== Services"
install -m 644 "$here/premiere-worker.service" "$here/premiere-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable premiere-worker premiere-web

echo "Setup done. Release the app with deploy/ship.sh from the dev machine."
