# =======================
# HTTP -> HTTPS redirect
# /etc/nginx/sites-available/api.chess99.com
# =======================
server {
    listen 80;
    listen [::]:80;
    server_name api.chess99.com;
    return 301 https://$host$request_uri;
}

# =======================
# HTTPS App Server
# =======================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.chess99.com;

    # --- SSL (Certbot) ---
    ssl_certificate /etc/letsencrypt/live/api.chess99.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chess99.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # --- Laravel public dir ---
    root /opt/Chess-Web/chess-backend/public;
    index index.php;

    # --- Route ALL non-files to Laravel ---
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # --- PHP-FPM ---
    # Use ONE include; don't double-include fastcgi params.
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        # Ensure SCRIPT_FILENAME matches the docroot
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # --- Static files (optional cache) ---
    location ~* \.(?:jpg|jpeg|png|gif|ico|css|js|woff2?|ttf|svg)$ {
        expires 30d;
        access_log off;
        try_files $uri =404;
    }

    # --- Hide dotfiles except ACME ---
    location ~ /\.(?!well-known) {
        deny all;
    }

    # --- Laravel Reverb WebSocket proxy (/app) ---
    # Frontend should connect to wss://api.chess99.com/app
    location /app {
        proxy_pass http://127.0.0.1:8080;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Optional: handle CORS preflights to /app
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "https://chess99.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            return 204;
        }
    }
}
