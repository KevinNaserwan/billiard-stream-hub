#!/usr/bin/env bash
set -e

# Setup in-memory circular buffer path on Linux RAM-disk
BUFFER_PATH="/dev/shm/billiard_buffers"

echo "=== Initializing BilliardStream Hub RAM-Disk Buffers ==="
if [ ! -d "$BUFFER_PATH" ]; then
  sudo mkdir -p "$BUFFER_PATH"
  sudo chmod 777 "$BUFFER_PATH"
  echo "Created RAM buffer directory: $BUFFER_PATH"
else
  echo "RAM buffer directory already exists: $BUFFER_PATH"
fi

echo "=== RAM Buffer Setup Complete ==="
