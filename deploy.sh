#!/bin/bash
# ============================================================================
# Chess-Web Production Deployment Script
# ============================================================================
# This script handles deployment of both backend (Laravel) and frontend (React)
# For initial setup instructions, see: docs/PRODUCTION_DEPLOYMENT.md
# ============================================================================

set -e  # Exit on error

# Configuration
PROJECT_DIR="/opt/Chess-Web"
BACKEND_DIR="$PROJECT_DIR/chess-backend"
FRONTEND_DIR="$PROJECT_DIR/chess-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# Main Deployment Script
# ============================================================================

echo "🚀 Starting Chess-Web deployment..."
echo "================================================"

# 1. Pull latest code
log_info "Pulling latest code from repository..."
cd "$PROJECT_DIR"
git pull origin master

# 2. Backend deployment
echo ""
log_info "Deploying backend..."
cd "$BACKEND_DIR"

log_info "Installing backend dependencies..."
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader

log_info "Running database migrations..."
sudo -u www-data php artisan migrate --force

log_info "Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

log_info "Optimizing application..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Frontend deployment
echo ""
log_info "Deploying frontend..."
cd "$FRONTEND_DIR"

log_info "Installing frontend dependencies..."
npm install

log_info "Building frontend..."
npm run build

log_info "Deploying frontend to web server..."
rsync -av --delete build/ /var/www/chess99.com/

# 4. Set correct permissions
echo ""
log_info "Setting permissions..."
chown -R www-data:www-data "$BACKEND_DIR/storage"
chown -R www-data:www-data "$BACKEND_DIR/bootstrap/cache"
chmod 664 "$BACKEND_DIR/database/database.sqlite"

# 5. Restart services
echo ""
log_info "Restarting services..."
systemctl restart php8.3-fpm
systemctl restart laravel-reverb 2>/dev/null || log_warn "laravel-reverb service not found (may not be configured yet)"
systemctl reload nginx

# 6. Health check
echo ""
log_info "Running health checks..."

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    log_info "Nginx is running"
else
    log_error "Nginx is not running!"
    exit 1
fi

# Check if php-fpm is running
if systemctl is-active --quiet php8.3-fpm; then
    log_info "PHP-FPM is running"
else
    log_error "PHP-FPM is not running!"
    exit 1
fi

echo ""
echo "================================================"
log_info "Deployment complete! ✅"
echo "================================================"
echo ""
echo "Next steps:"
echo "  • Check logs: tail -f $BACKEND_DIR/storage/logs/laravel.log"
echo "  • Monitor Nginx: tail -f /var/log/nginx/error.log"
echo "  • Test application in browser"
