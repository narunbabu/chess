php artisan tinker --execute="DB::table('invitations')->select('id', 'inviter_id', 'invited_id', 'inviter_preferred_color', 'status')->get()"

sqlite3 database/database.sqlite "SELECT * FROM invitations WHERE id = 1;"
php artisan reverb:start --debug 

While editing or implementing additional functionality or building additional elements care must be taken. Disturbing already working functionality could be catastrophic and it may result in unintended side effects and subogate some unseen functionality. So keep this in mind to not disturb already tested and working functionality.