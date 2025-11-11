#!/bin/bash
# Deploy nginx CORS fix to production server
# Run this script to update nginx configuration on the server

echo "🚀 Deploying nginx CORS configuration..."

# Backup current nginx config
echo "📦 Backing up current configuration..."
sudo cp /etc/nginx/sites-available/api.chess99.com /etc/nginx/sites-available/api.chess99.com.backup-$(date +%Y%m%d-%H%M%S)

# Copy new configuration
echo "📝 Updating nginx configuration..."
sudo cp /opt/Chess-Web/nginx-api-fix.conf /etc/nginx/sites-available/api.chess99.com

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid!"

    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx

    echo "✅ Nginx reloaded successfully!"
    echo ""
    echo "🎉 CORS headers are now enabled!"
    echo ""
    echo "📋 Test CORS headers with:"
    echo "curl -I https://api.chess99.com/storage/avatars/test.jpg"
    echo ""
    echo "Expected headers:"
    echo "  Access-Control-Allow-Origin: https://chess99.com"
    echo "  Access-Control-Allow-Methods: GET, OPTIONS"
else
    echo "❌ Nginx configuration test failed!"
    echo "Configuration has NOT been applied."
    echo "Please check the error messages above."
    exit 1
fi
