#!/bin/bash
# Diagnostic script to check pnpm installation
# Run this on the server: bash diagnose-pnpm.sh

echo "=== pnpm Diagnostic Report ==="
echo ""

echo "1. Checking pnpm in PATH:"
command -v pnpm && echo "✅ pnpm found: $(which pnpm)" || echo "❌ pnpm not in PATH"
echo ""

echo "2. Checking Node/npm versions:"
node --version 2>/dev/null || echo "❌ Node not found"
npm --version 2>/dev/null || echo "❌ npm not found"
echo ""

echo "3. Checking NVM environment:"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm current 2>/dev/null || echo "ℹ️  NVM not loaded"
echo ""

echo "4. After loading NVM:"
command -v pnpm && echo "✅ pnpm found: $(which pnpm)" || echo "❌ pnpm still not in PATH"
echo ""

echo "5. Checking npm global packages:"
npm list -g --depth=0 2>/dev/null | grep pnpm || echo "ℹ️  pnpm not in npm global packages"
echo ""

echo "6. Checking npm global bin directory:"
NPM_GLOBAL=$(npm config get prefix 2>/dev/null)
echo "npm global prefix: $NPM_GLOBAL"
ls -la "$NPM_GLOBAL/bin/" 2>/dev/null | grep pnpm || echo "ℹ️  pnpm not in npm bin directory"
echo ""

echo "7. Checking corepack:"
corepack --version 2>/dev/null && echo "✅ Corepack available" || echo "ℹ️  Corepack not available"
echo ""

echo "8. Trying to enable pnpm via corepack:"
corepack enable 2>/dev/null && corepack prepare pnpm@latest --activate 2>/dev/null
command -v pnpm && echo "✅ pnpm enabled via corepack: $(which pnpm)" || echo "❌ corepack enable failed"
echo ""

echo "9. Current PATH:"
echo "$PATH" | tr ':' '\n' | nl
echo ""

echo "=== End of Diagnostic Report ==="
