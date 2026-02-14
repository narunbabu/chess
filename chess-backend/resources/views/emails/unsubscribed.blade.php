<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribed - Chess99</title>
    <style>
        body {
            margin: 0; padding: 0;
            background-color: #f4f4f7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333;
        }
        .container {
            max-width: 500px;
            margin: 60px auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            overflow: hidden;
            text-align: center;
        }
        .header {
            background-color: #1b5e20;
            padding: 20px;
            color: #fff;
        }
        .header h1 { margin: 0; font-size: 22px; }
        .body { padding: 40px 32px; }
        .body h2 { color: #1b5e20; margin-top: 0; }
        .body p { color: #666; font-size: 15px; }
        .btn {
            display: inline-block; padding: 12px 28px;
            background-color: #2e7d32; color: #fff !important;
            text-decoration: none; border-radius: 6px;
            font-weight: 600; font-size: 15px;
            margin-top: 16px;
        }
        .footer { padding: 16px 32px; background: #fafafa; font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>&#9814; Chess99</h1>
        </div>
        <div class="body">
            <h2>You've been unsubscribed</h2>
            <p>You will no longer receive marketing emails from Chess99.</p>
            <p>Changed your mind? You can update your preferences at any time.</p>
            <a href="{{ $preferencesUrl }}" class="btn">Manage Preferences</a>
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} Chess99. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
