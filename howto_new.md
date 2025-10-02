ssh root@69.62.73.225
SonNaxxxxxx@..3


 sudo apt update
  sudo apt install -y php8.3 php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath
  php8.3-redis php8.3-gd

apt update
apt install -y git nginx

cd /opt
git clone https://github.com/narunbabu/chess.git Chess-Web
cd Chess-Web
git checkout master   # if not default
This gives you:

/opt/Chess-Web/chess-backend

/opt/Chess-Web/chess-frontend

cd /opt/Chess-Web
git pull origin master

cd chess-backend
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader
sudo -u www-data php artisan migrate --force
php artisan cache:clear



# .env and app key
cp -n .env.example .env
php artisan key:generate

# SQLite (simple to start)
mkdir -p database
touch database/database.sqlite


# From your VPS
apt update
apt install -y php8.3-curl php8.3-xml

# confirm they’re loaded
php -m | grep -E 'curl|dom'   # should show: curl  and  dom

# restart PHP-FPM (good practice)
systemctl restart php8.3-fpm




scp -r /mnt/c/ArunApps/Chess-Web/chess-backend/.env root@69.62.73.225:/opt/Chess-Web/chess-backend/.env

# 3) Set sensible ownership/permissions
chown www-data:www-data /opt/Chess-Web/chess-backend/.env
chmod 640 /opt/Chess-Web/chess-backend/.env


cd /opt/Chess-Web/chess-backend

# Generate app key (writes APP_KEY in .env)
php artisan key:generate

# Create SQLite DB file if not already present
mkdir -p database
touch database/database.sqlite

# Switch to sqlite in .env (safe to re-run)
sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env
sed -i 's/^DB_HOST=.*/# DB_HOST=127.0.0.1/' .env
sed -i 's/^DB_PORT=.*/# DB_PORT=3306/' .env
sed -i 's/^DB_DATABASE=.*/# DB_DATABASE=/' .env
sed -i 's/^DB_USERNAME=.*/# DB_USERNAME=/' .env
sed -i 's/^DB_PASSWORD=.*/# DB_PASSWORD=/' .env

# Storage link
php artisan storage:link

# Run migrations as www-data
sudo -u www-data php artisan migrate --force

# (optional but good)
php artisan config:clear
php artisan cache:clear
systemctl restart php8.3-fpm
