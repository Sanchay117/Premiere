#!/usr/bin/env bash
# Ships the committed HEAD to the VM and releases it there (deploy/release.sh). Run from the repo
# root on the dev machine, signed in to gcloud. Uncommitted changes are not shipped.
#
#   deploy/ship.sh
#
# On Windows, run it from Git Bash with GCLOUD set to the SDK's bin/gcloud shell script, not
# gcloud.cmd: cmd.exe mangles the quoted remote command when the SDK path has spaces in it.
set -euo pipefail

PROJECT=${PROJECT:-premiere-trailers}
ZONE=${ZONE:-us-central1-a}
VM=${VM:-premiere}
GCLOUD=${GCLOUD:-gcloud}

cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --short HEAD)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tarball="$work/premiere-$sha.tar.gz"
# autocrlf off: on Windows, git archive would otherwise give the shell scripts CRLF endings.
git -c core.autocrlf=false archive --format=tar.gz -o "$tarball" HEAD
cp deploy/release.sh "$work/release.sh"

# gcloud.cmd is a Windows program and needs Windows paths.
local_path() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
ssh_flags=(--project "$PROJECT" --zone "$ZONE" --tunnel-through-iap --quiet)

echo "Shipping $sha to $VM"
"$GCLOUD" compute scp "${ssh_flags[@]}" "$(local_path "$tarball")" "$(local_path "$work/release.sh")" "$VM:/tmp/"
"$GCLOUD" compute ssh "$VM" "${ssh_flags[@]}" --command "sudo bash /tmp/release.sh /tmp/premiere-$sha.tar.gz"
