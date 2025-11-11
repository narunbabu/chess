#!/bin/bash
# Emergency dependency recovery script
# Run this on the server to fix the broken node_modules

set -e

echo "🚨 Emergency Dependency Recovery"
echo "================================="

cd /opt/Chess-Web/chess-frontend

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 || nvm install 20

echo "📦 Current Node version:"
node --version
npm --version

# Clean everything
echo ""
echo "🧹 Cleaning old files..."
rm -rf node_modules
rm -f package-lock.json
npm cache clean --force

# Fresh install
echo ""
echo "📦 Installing dependencies fresh..."
npm install

# Verify installation
echo ""
echo "✅ Verifying installation..."
if [ -f node_modules/.bin/react-scripts ]; then
  echo "✅ react-scripts installed successfully"
  ls -lh node_modules/.bin/react-scripts
else
  echo "❌ react-scripts still missing!"
  exit 1
fi

# Check all required packages
echo ""
echo "📋 Checking critical packages..."
npm list react-scripts || echo "⚠️  react-scripts version check failed"
npm list react || echo "⚠️  react version check failed"
npm list react-dom || echo "⚠️  react-dom version check failed"

echo ""
echo "✅ Recovery complete!"
echo ""
echo "You can now run: npm run build"
