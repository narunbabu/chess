rsync -av --delete /opt/Chess-Web/chess-frontend/build/ /var/www/chess99.com/


grep -E '(GOOGLE|FRONTEND|APP_URL)'" 2>/dev/null ||  echo "Cannot connect to server"

"cd /opt/Chess-Web/chess-backend && cat .env | grep -E '(GOOGLE|FRONTEND|APP_URL)'" 2>/dev/null ||   echo "Cannot connect to server"


APP_NAME=Laravel
APP_ENV=local

APP_DEBUG=true
APP_URL=https://api.chess99.com

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
# APP_MAINTENANCE_STORE=database

PHP_CLI_SERVER_WORKERS=4

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug



DB_CONNECTION=sqlite

# Use file-backed cache/session so Artisan never hits DB
CACHE_DRIVER=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync


# DB_HOST=127.0.0.1
# DB_PORT=3306

# DB_USERNAME=
# DB_PASSWORD=

SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=.chess99.com
SESSION_SECURE_COOKIE=true
BROADCAST_CONNECTION=reverb
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync


# CACHE_STORE=database
# CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"



#chess-web in narun.iitb@gmail.com chess project

GOOGLE_REDIRECT_URL=https://api.chess99.com/auth/google/callback
FRONTEND_URL=https://chess99.com

FACEBOOK_CLIENT_ID=1369632143916587
FACEBOOK_CLIENT_SECRET=8112c3bfc0cc7b7062f9221a62706418
FACEBOOK_REDIRECT_URI=http://localhost:8000/api/auth/facebook/callback

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"


REVERB_APP_ID=874208
REVERB_APP_KEY=anrdh24nppf3obfupvqw
REVERB_APP_SECRET=d8ngbhjm2kfzncggjdui
REVERB_HOST="localhost"
REVERB_PORT=8080
REVERB_SCHEME=http

# Reverb timeout settings (prevent premature disconnections)
REVERB_APP_PING_INTERVAL=30
REVERB_APP_ACTIVITY_TIMEOUT=120

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"