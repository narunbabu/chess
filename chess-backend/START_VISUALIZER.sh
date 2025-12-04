#!/bin/bash

echo "========================================"
echo "  Tournament Visualizer Server"
echo "========================================"
echo ""
echo "Starting server at http://localhost:8080"
echo ""
echo "Open in browser: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

cd public
php -S localhost:8080 serve.php
