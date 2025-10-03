commit 3ae001332fb25fb4e56a7cdcfe5e951c61decaa9 (HEAD -> master)
Author: narunbabu <narun.iitb@gmail.com>
Date:   Thu Oct 2 06:10:11 2025 +0530

    added howto_new.md after merge with online git, but this hs problems in it

commit 213996a38ffb793a3b8524e002ec2261f26dc0e6 (origin/master, origin/HEAD)
Merge: 11e315e 3703d17
Author: narunbabu <narun.iitb@gmail.com>
Date:   Thu Oct 2 04:44:03 2025 +0530

    Merge origin/master into master: resolve conflicts keeping local changes

__________________________


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
scp chess-backend/.env.server  root@69.62.73.225:/opt/Chess-Web/chess-backend
scp chess-frontend/.env.production root@69.62.73.225:/opt/Chess-Web/chess-frontend/.env
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

 ALTER USER 'chess_user'@'localhost' IDENTIFIED BY 'Chess99Arun';      
  FLUSH PRIVILEGES;
  exit;

# Storage link
php artisan storage:link

# Run migrations as www-data
sudo -u www-data php artisan migrate --force

# (optional but good)
php artisan config:clear
php artisan cache:clear
systemctl restart php8.3-fpm

php artisan optimize:clear


  # Create .ssh directory first (if it doesn't exist)
  mkdir $env:USERPROFILE\.ssh -Force

  # Generate SSH key with full path
  ssh-keygen -t ed25519 -C "github-actions-deploy" -f $env:USERPROFILE\.ssh\github_deploy

  Then to view the keys:

  # View private key (for GitHub Secret)
  cat $env:USERPROFILE\.ssh\github_deploy

  # View public key (for server)
  cat $env:USERPROFILE\.ssh\github_deploy.pub

  To copy public key to server:

  # Display public key
  cat $env:USERPROFILE\.ssh\github_deploy.pub

  # Then manually add it to server:
  ssh user@your-server-ip
  mkdir -p ~/.ssh
  nano ~/.ssh/authorized_keys
  # Paste the public key, save and exit
  chmod 600 ~/.ssh/authorized_key