#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=========================================================="
echo "🎱 Starting BilliardStream Hub (Local Stand-Alone Edge)  "
echo "=========================================================="

# Ensure RAM-disk exists
mkdir -p /dev/shm/billiard_buffers 2>/dev/null || true

# Run application server
export PORT=3000
export BUFFER_PATH="/dev/shm/billiard_buffers"
node server/app.js
