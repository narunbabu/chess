# Production Deployment Checklist

**Last Updated:** 2025-10-02
**Project:** Chess-Web (chess99.com)

---

## ✅ Pre-Deployment Checklist

### 1. Server Requirements

- [ ] Ubuntu 22.04 LTS or newer
- [ ] PHP 8.3 with extensions: `php8.3-fpm php8.3-mysql php8.3-redis php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip`
- [ ] Nginx 1.18+
- [ ] MySQL 8.0+ or MariaDB 10.6+
- [ ] Redis 6.0+
- [ ] Node.js 18+ and npm
- [ ] Composer 2.x
- [ ] Certbot for SSL certificates

### 2. Domain & DNS Configuration

- [ ] Domain `chess99.com` points to server IP (A record)
- [ ] Subdomain `api.chess99.com` points to server IP (A record)
- [ ] SSL certificates obtained for both domains:
  ```bash
  sudo certbot certonly --nginx -d chess99.com -d www.chess99.com
  sudo certbot certonly --nginx -d api.chess99.com
  ```

### 3. Database Setup

- [ ] MySQL database created:
  ```sql
  CREATE DATABASE chess_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'chess_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
  GRANT ALL PRIVILEGES ON chess_production.* TO 'chess_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

### 4. OAuth Credentials (Production)

- [ ] **Google OAuth** - Add production redirect URL in Google Console:
  - Authorized redirect URI: `https://api.chess99.com/auth/google/callback`
  - Update `.env.server` with production client ID/secret if different

- [ ] **Facebook OAuth** - Add production domain in Facebook App:
  - App Domain: `chess99.com`
  - Redirect URI: `https://api.chess99.com/api/auth/facebook/callback`
  - Update `.env.server` with production app ID/secret if different

---

## 🚀 Initial Deployment Steps

### Step 1: Clone Repository

```bash
# Create project directory
sudo mkdir -p /opt/Chess-Web
sudo chown $USER:$USER /opt/Chess-Web

# Clone repository
cd /opt
git clone https://github.com/YOUR_USERNAME/Chess-Web.git
cd Chess-Web
```

### Step 2: Backend Setup

```bash
cd /opt/Chess-Web/chess-backend

# Copy production environment file
cp .env.server .env

# Edit .env and update these values:
# - DB_PASSWORD (your MySQL password)
# - MAIL_USERNAME and MAIL_PASSWORD (if using email)
# - Any other production-specific values
nano .env

# Install dependencies
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader --classmap-authoritative

# Generate application key (if not already set)
php artisan key:generate

# Run migrations
php artisan migrate --force

# Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

### Step 3: Frontend Setup

```bash
cd /opt/Chess-Web/chess-frontend

# Install dependencies
npm install

# Build for production
npm run build

# Create web root directory
sudo mkdir -p /var/www/chess99.com

# Copy build files
sudo rsync -av --delete build/ /var/www/chess99.com/

# Set permissions
sudo chown -R www-data:www-data /var/www/chess99.com
```

### Step 4: Nginx Configuration

```bash
# Copy API server config
sudo cp /opt/Chess-Web/sites.available.chess99.com /etc/nginx/sites-available/api.chess99.com

# Create frontend server config
sudo nano /etc/nginx/sites-available/chess99.com
```

**Frontend Nginx Configuration** (`/etc/nginx/sites-available/chess99.com`):
```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name chess99.com www.chess99.com;
    return 301 https://chess99.com$request_uri;
}

# HTTPS Frontend
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chess99.com www.chess99.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/chess99.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chess99.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend build directory
    root /var/www/chess99.com;
    index index.html;

    # React Router - all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2?|ttf|svg)$ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Enable sites:**
```bash
# Enable both sites
sudo ln -s /etc/nginx/sites-available/api.chess99.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/chess99.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: Laravel Reverb Service

```bash
# Copy service file
sudo cp /opt/Chess-Web/reverb.service /etc/systemd/system/laravel-reverb.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable laravel-reverb
sudo systemctl start laravel-reverb

# Check status
sudo systemctl status laravel-reverb
```

### Step 6: Verify Deployment

```bash
# Check all services are running
sudo systemctl status nginx
sudo systemctl status php8.3-fpm
sudo systemctl status laravel-reverb
sudo systemctl status mysql
sudo systemctl status redis

# Check Laravel logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/laravel.log

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Check Reverb logs
sudo journalctl -u laravel-reverb -f
```

### Step 7: Test Application

- [ ] Visit `https://chess99.com` - Should load React frontend
- [ ] Test Google login - Should redirect correctly
- [ ] Test WebSocket connection - Open browser console, check for:
  ```
  [Echo] Successfully connected. Socket ID: XXXXX.XXXXX
  ```
- [ ] Send game invitation - Should receive real-time notification
- [ ] Play a game - Moves should sync in real-time

---

## 🔄 Ongoing Deployments

### Automated (GitHub Actions)

Once initial setup is complete, deployments are automatic:

1. **Setup GitHub Secrets** (One-time):
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `SERVER_HOST`: Your server IP address
     - `SERVER_USER`: SSH username (usually `ubuntu` or `root`)
     - `SERVER_SSH_KEY`: Your private SSH key (PEM format)

2. **Deploy**:
   ```bash
   # Push to master branch
   git push origin master

   # GitHub Actions will automatically:
   # - Pull latest code
   # - Install dependencies
   # - Run migrations
   # - Build frontend
   # - Deploy to production
   # - Restart services
   ```

### Manual Deployment

```bash
# SSH into server
ssh user@your-server-ip

# Run deployment script
cd /opt/Chess-Web
sudo ./deploy.sh
```

---

## 🔧 Maintenance Tasks

### Daily/Weekly

```bash
# Check logs for errors
sudo tail -100 /opt/Chess-Web/chess-backend/storage/logs/laravel.log
sudo tail -100 /var/log/nginx/error.log
sudo journalctl -u laravel-reverb --since "1 day ago"

# Monitor disk space
df -h

# Check service status
sudo systemctl status nginx php8.3-fpm laravel-reverb mysql redis
```

### Monthly

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Renew SSL certificates (auto-renews, but verify)
sudo certbot renew --dry-run

# Backup database
mysqldump -u chess_user -p chess_production > backup_$(date +%Y%m%d).sql

# Clean old logs
sudo find /opt/Chess-Web/chess-backend/storage/logs -name "*.log" -mtime +30 -delete
```

---

## 🚨 Troubleshooting

### WebSocket Not Connecting

```bash
# Check Reverb is running
sudo systemctl status laravel-reverb

# Check Reverb logs
sudo journalctl -u laravel-reverb -n 50

# Test WebSocket endpoint
curl -i https://api.chess99.com/app

# Should return 101 Switching Protocols
```

### 500 Internal Server Error

```bash
# Check Laravel logs
tail -50 /opt/Chess-Web/chess-backend/storage/logs/laravel.log

# Check PHP-FPM logs
tail -50 /var/log/php8.3-fpm.log

# Check permissions
ls -la /opt/Chess-Web/chess-backend/storage
ls -la /opt/Chess-Web/chess-backend/bootstrap/cache
```

### Database Connection Failed

```bash
# Test MySQL connection
mysql -u chess_user -p chess_production

# Check .env file
cat /opt/Chess-Web/chess-backend/.env | grep DB_

# Test from Laravel
cd /opt/Chess-Web/chess-backend
php artisan migrate:status
```

### Frontend Not Loading

```bash
# Check Nginx config
sudo nginx -t

# Check frontend files exist
ls -la /var/www/chess99.com/

# Check Nginx error log
tail -50 /var/log/nginx/error.log

# Rebuild frontend
cd /opt/Chess-Web/chess-frontend
npm run build
sudo rsync -av --delete build/ /var/www/chess99.com/
```

---

## 📝 Important Files & Paths

| Component | Path | Purpose |
|-----------|------|---------|
| Backend code | `/opt/Chess-Web/chess-backend` | Laravel application |
| Frontend code | `/opt/Chess-Web/chess-frontend` | React source |
| Frontend build | `/var/www/chess99.com` | Compiled React app |
| Backend env | `/opt/Chess-Web/chess-backend/.env` | Production config |
| Laravel logs | `/opt/Chess-Web/chess-backend/storage/logs/` | Application logs |
| Nginx config | `/etc/nginx/sites-available/` | Web server config |
| Reverb service | `/etc/systemd/system/laravel-reverb.service` | WebSocket service |
| SSL certs | `/etc/letsencrypt/live/` | SSL certificates |

---

## 🔐 Security Reminders

- [ ] Change all default passwords in `.env`
- [ ] Set `APP_DEBUG=false` in production
- [ ] Use strong `APP_KEY`
- [ ] Restrict database access to localhost only
- [ ] Keep system packages updated
- [ ] Enable firewall (UFW):
  ```bash
  sudo ufw allow 22/tcp   # SSH
  sudo ufw allow 80/tcp   # HTTP
  sudo ufw allow 443/tcp  # HTTPS
  sudo ufw enable
  ```
- [ ] Set up automated backups
- [ ] Monitor error logs regularly

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in `/opt/Chess-Web/chess-backend/storage/logs/laravel.log`
3. Check Reverb logs: `sudo journalctl -u laravel-reverb -n 100`
4. Check Nginx logs: `/var/log/nginx/error.log`

---

**Deployment Version:** 1.0.0
**Last Tested:** 2025-10-02
