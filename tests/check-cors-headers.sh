#!/bin/bash
# Check if CORS headers are actually being sent

echo "🔍 Checking CORS headers on avatar URLs..."
echo ""

# Test with an actual avatar URL
echo "Testing: https://api.chess99.com/storage/avatars/j1EjOKqct7HGcqNtLWYKLtEMQsmvFSxjMFVjmqRP.jpg"
echo ""

curl -I -H "Origin: https://chess99.com" https://api.chess99.com/storage/avatars/j1EjOKqct7HGcqNtLWYKLtEMQsmvFSxjMFVjmqRP.jpg 2>&1 | grep -i "access-control"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CORS headers are present!"
else
    echo ""
    echo "❌ CORS headers are NOT present!"
    echo ""
    echo "Let's check the current nginx config..."
    echo ""
    sudo cat /etc/nginx/sites-available/api.chess99.com | grep -A5 "storage"
fi
