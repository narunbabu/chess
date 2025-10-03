root@mail:/opt/Chess-Web/chess-backend# sudo -u www-data /usr/local/bin/composer install --no-dev --optimize-autoloader --classmap-authoritative
Sorry, user root is not allowed to execute '/usr/local/bin/composer install --no-dev --optimize-autoloader --classmap-authoritative' as www-data on mail.sambandhalu.com.
root@mail:/opt/Chess-Web/chess-backend# www-data /usr/local/bin/composer install --no-dev --optimize-autoloader --classmap-authoritative
www-data: command not found
root@mail:/opt/Chess-Web/chess-backend# su ubuntu
ubuntu@mail:/opt/Chess-Web/chess-backend$ sudo -u www-data /usr/local/bin/composer install --no-dev --optimize-autoloader --classmap-authoritative
Installing dependencies from lock file
Verifying lock file contents can be installed on current platform.
Nothing to install, update or remove
Generating optimized autoload files
> Illuminate\Foundation\ComposerScripts::postAutoloadDump
> @php artisan package:discover --ansi

   INFO  Discovering packages.

  laravel/reverb ................................................................................................ DONE
  laravel/sanctum ............................................................................................... DONE
  laravel/socialite ............................................................................................. DONE
  laravel/tinker ................................................................................................ DONE
  nesbot/carbon ................................................................................................. DONE
  nunomaduro/termwind ........................................................................................... DONE
  phiki/phiki ................................................................................................... DONE

77 packages you are using are looking for funding.
Use the `composer fund` command to find out more!
ubuntu@mail:/opt/Chess-Web/chess-backend$ su root
Password:
root@mail:/opt/Chess-Web/chess-backend# php artisan migrate


                                               APPLICATION IN PRODUCTION.


 ┌ Are you sure you want to run this command? ──────────────────┐
 │ Yes                                                          │
 └──────────────────────────────────────────────────────────────┘

   INFO  Running migrations.

  2025_09_27_124212_create_user_presence_table .......................................................... 11.62ms FAIL

In Connection.php line 824:

  SQLSTATE[42S01]: Base table or view already exists: 1050 Table 'user_presence' already exists (Connection: mysql, S
  QL: create table `user_presence` (`id` bigint unsigned not null auto_increment primary key, `user_id` bigint unsign
  ed not null, `status` enum('online', 'away', 'offline') not null default 'offline', `socket_id` varchar(255) null,
  `device_info` json null, `last_activity` timestamp null, `current_game_id` bigint unsigned null, `game_status` enum
  ('waiting', 'playing', 'spectating') null, `created_at` timestamp null, `updated_at` timestamp null) default charac
  ter set utf8mb4 collate 'utf8mb4_unicode_ci')


In Connection.php line 570:

  SQLSTATE[42S01]: Base table or view already exists: 1050 Table 'user_presence' already exists


root@mail:/opt/Chess-Web/chess-backend# php artisan migrate --force

   INFO  Running migrations.

  2025_09_27_124212_create_user_presence_table ........................................................... 9.18ms FAIL

In Connection.php line 824:

  SQLSTATE[42S01]: Base table or view already exists: 1050 Table 'user_presence' already exists (Connection: mysql, S
  QL: create table `user_presence` (`id` bigint unsigned not null auto_increment primary key, `user_id` bigint unsign
  ed not null, `status` enum('online', 'away', 'offline') not null default 'offline', `socket_id` varchar(255) null,
  `device_info` json null, `last_activity` timestamp null, `current_game_id` bigint unsigned null, `game_status` enum
  ('waiting', 'playing', 'spectating') null, `created_at` timestamp null, `updated_at` timestamp null) default charac
  ter set utf8mb4 collate 'utf8mb4_unicode_ci')


In Connection.php line 570:

  SQLSTATE[42S01]: Base table or view already exists: 1050 Table 'user_presence' already exists


root@mail:/opt/Chess-Web/chess-backend# php artisan migrate:refresh


                                               APPLICATION IN PRODUCTION.


 ┌ Are you sure you want to run this command? ──────────────────┐
 │ Yes                                                          │
 └──────────────────────────────────────────────────────────────┘

   INFO  Rolling back migrations.

  2025_09_27_120000_create_invitations_table ............................................................ 39.87ms DONE
  2025_09_27_090137_make_password_nullable_in_users_table ............................................... 85.41ms DONE
  2025_03_15_180745_create_personal_access_tokens_table ................................................. 26.02ms DONE
  2025_03_15_172924_create_game_histories_table ......................................................... 16.44ms DONE
  2025_03_15_004921_add_social_auth_fields_to_users_table ............................................... 73.65ms DONE
  0001_01_01_000002_create_jobs_table ................................................................... 79.58ms DONE
  0001_01_01_000001_create_cache_table .................................................................. 55.65ms DONE
  0001_01_01_000000_create_users_table ................................................................... 2.26ms FAIL

In Connection.php line 824:

  SQLSTATE[HY000]: General error: 3730 Cannot drop table 'users' referenced by a foreign key constraint 'user_presenc
  e_user_id_foreign' on table 'user_presence'. (Connection: mysql, SQL: drop table if exists `users`)


In Connection.php line 570:

  SQLSTATE[HY000]: General error: 3730 Cannot drop table 'users' referenced by a foreign key constraint 'user_presenc
  e_user_id_foreign' on table 'user_presence'.


root@mail:/opt/Chess-Web/chess-backend# # See if the table is there
mysql -u root -p -D chess_production -e "SHOW TABLES LIKE 'user_presence';"

# See if Laravel thinks that migration already ran
mysql -u root -p -D chess_production -e \
  "SELECT migration,batch FROM migrations WHERE migration LIKE '%create_user_presence_table%';"
Enter password:
+--------------------------------------------+
| Tables_in_chess_production (user_presence) |
+--------------------------------------------+
| user_presence                              |
+--------------------------------------------+
Enter password:
root@mail:/opt/Chess-Web/chess-backend#