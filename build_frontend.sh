#!/bin/bash

# Frontend Build Script for Chess Web Application

set -e

echo "🏗️  Building Chess Web Frontend..."
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from chess-frontend directory."
    exit 1
fi

# Set build environment variables
export DISABLE_ESLINT_PLUGIN=true
export CI=false
export GENERATE_SOURCEMAP=false

echo "📦 Installing dependencies..."
npm install

echo "🏗️  Building React application..."
npm run build

echo "📤 Deploying build to web server..."
rsync -av --delete build/ /var/www/chess99.com/

echo "✅ Frontend build and deployment complete!"
echo "🌐 Website updated at https://chess99.com"