#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="opencode-local"

docker build -t "$IMAGE_NAME" -f Dockerfile .
docker run --rm -it \
  -v "$(pwd)":/workspace \
  -v opencode_node_modules:/workspace/node_modules \
  -w /workspace \
  "$IMAGE_NAME" \
  bash
