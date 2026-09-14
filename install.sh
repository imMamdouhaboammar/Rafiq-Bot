#!/usr/bin/env bash
set -euo pipefail

echo "================================─────────────────────────"
echo "  Installing Rafiq-Bot Multi-Agent Skill Engine          "
echo "================================─────────────────────────"

TARGET_DIR="${HOME}/.agents/skills/rafiq-bot"
mkdir -p "${TARGET_DIR}"

# Copy codebase documentation & manifests to multi-agent skill registry
cp README.md "${TARGET_DIR}/SKILL.md" 2>/dev/null || true
cp package.json "${TARGET_DIR}/" 2>/dev/null || true

echo "✓ Installed Rafiq-Bot skill to ${TARGET_DIR}"
echo "✓ Universal install complete. Run 'npx rafiq-bot dev' or 'bun run dev' to launch."
