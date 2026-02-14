<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Chess99')</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f4f4f7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #333333;
            line-height: 1.6;
        }
        .email-wrapper {
            width: 100%;
            padding: 24px 0;
            background-color: #f4f4f7;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .email-header {
            background-color: #1b5e20;
            padding: 24px 32px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 1px;
        }
        .email-header .chess-icon {
            font-size: 32px;
            margin-bottom: 4px;
        }
        .email-body {
            padding: 32px;
        }
        .email-body h2 {
            margin-top: 0;
            color: #1b5e20;
            font-size: 22px;
        }
        .email-body p {
            margin: 12px 0;
            font-size: 15px;
            color: #555555;
        }
        .btn {
            display: inline-block;
            padding: 12px 28px;
            background-color: #2e7d32;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 15px;
            margin: 16px 0;
        }
        .btn:hover {
            background-color: #1b5e20;
        }
        .btn-secondary {
            background-color: #757575;
        }
        .stat-card {
            display: inline-block;
            background-color: #e8f5e9;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 6px;
            text-align: center;
            min-width: 100px;
        }
        .stat-card .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #1b5e20;
            display: block;
        }
        .stat-card .stat-label {
            font-size: 12px;
            color: #666666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .divider {
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 24px 0;
        }
        .email-footer {
            padding: 24px 32px;
            background-color: #fafafa;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }
        .email-footer p {
            margin: 4px 0;
            font-size: 12px;
            color: #999999;
        }
        .email-footer a {
            color: #2e7d32;
            text-decoration: underline;
        }
        @media only screen and (max-width: 620px) {
            .email-body { padding: 20px 16px; }
            .email-header { padding: 16px; }
            .email-footer { padding: 16px; }
            .stat-card { min-width: 80px; padding: 12px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <div class="chess-icon">&#9814;</div>
                <h1>Chess99</h1>
            </div>

            <div class="email-body">
                @yield('content')
            </div>

            <div class="email-footer">
                <p>You received this email because you have an account on Chess99.</p>
                <p>
                    <a href="{{ $unsubscribeUrl ?? '#' }}">Unsubscribe</a>
                    &nbsp;&middot;&nbsp;
                    <a href="{{ $preferencesUrl ?? '#' }}">Email Preferences</a>
                </p>
                <p>&copy; {{ date('Y') }} Chess99. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
