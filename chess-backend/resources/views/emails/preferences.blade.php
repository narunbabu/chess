<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Preferences - Chess99</title>
    <style>
        body {
            margin: 0; padding: 0;
            background-color: #f4f4f7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333;
        }
        .container {
            max-width: 500px;
            margin: 40px auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            overflow: hidden;
        }
        .header {
            background-color: #1b5e20;
            padding: 20px;
            text-align: center;
            color: #fff;
        }
        .header h1 { margin: 0; font-size: 22px; }
        .body { padding: 32px; }
        .body h2 { margin-top: 0; color: #1b5e20; }
        label {
            display: flex; align-items: center; gap: 12px;
            padding: 14px 0;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            font-size: 15px;
        }
        label:last-of-type { border-bottom: none; }
        input[type="checkbox"] {
            width: 20px; height: 20px;
            accent-color: #2e7d32;
        }
        .label-desc { font-size: 12px; color: #888; }
        .btn {
            display: inline-block; padding: 12px 28px;
            background-color: #2e7d32; color: #fff;
            border: none; border-radius: 6px;
            font-weight: 600; font-size: 15px;
            cursor: pointer; margin-top: 16px;
        }
        .btn:hover { background-color: #1b5e20; }
        .btn-danger {
            background-color: #c62828;
            margin-left: 8px;
        }
        .btn-danger:hover { background-color: #b71c1c; }
        .success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
        .footer { padding: 16px 32px; background: #fafafa; text-align: center; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>&#9814; Chess99 Email Preferences</h1>
        </div>
        <div class="body">
            <h2>Hi {{ $user->name }},</h2>
            <p>Choose which emails you'd like to receive from Chess99.</p>

            @if(session('success'))
                <div class="success">{{ session('success') }}</div>
            @endif

            <form method="POST" action="{{ $formAction }}">
                @csrf

                <label>
                    <input type="checkbox" name="email_notifications_enabled" value="1"
                        {{ $user->email_notifications_enabled ? 'checked' : '' }}>
                    <div>
                        <strong>Master Toggle</strong>
                        <div class="label-desc">Enable or disable all email notifications</div>
                    </div>
                </label>

                <label>
                    <input type="checkbox" name="preferences[play_reminder]" value="1"
                        {{ ($user->email_preferences['play_reminder'] ?? true) ? 'checked' : '' }}>
                    <div>
                        <strong>Play Reminders</strong>
                        <div class="label-desc">Reminders to come back and play when you've been away</div>
                    </div>
                </label>

                <label>
                    <input type="checkbox" name="preferences[weekly_digest]" value="1"
                        {{ ($user->email_preferences['weekly_digest'] ?? true) ? 'checked' : '' }}>
                    <div>
                        <strong>Weekly Digest</strong>
                        <div class="label-desc">Weekly summary of your games, wins, and rating changes</div>
                    </div>
                </label>

                <label>
                    <input type="checkbox" name="preferences[tournament_announcement]" value="1"
                        {{ ($user->email_preferences['tournament_announcement'] ?? true) ? 'checked' : '' }}>
                    <div>
                        <strong>Tournament Announcements</strong>
                        <div class="label-desc">Notifications about new tournaments and registration</div>
                    </div>
                </label>

                <label>
                    <input type="checkbox" name="preferences[match_reminder]" value="1"
                        {{ ($user->email_preferences['match_reminder'] ?? true) ? 'checked' : '' }}>
                    <div>
                        <strong>Match Reminders</strong>
                        <div class="label-desc">Reminders for upcoming championship matches</div>
                    </div>
                </label>

                <div style="margin-top: 20px;">
                    <button type="submit" class="btn">Save Preferences</button>
                    <a href="{{ $unsubscribeUrl }}" class="btn btn-danger"
                       onclick="return confirm('Are you sure you want to unsubscribe from all emails?')">
                        Unsubscribe from All
                    </a>
                </div>
            </form>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} Chess99. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
