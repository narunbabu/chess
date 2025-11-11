<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- Basic Meta Tags -->
    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}">

    <!-- Open Graph Meta Tags (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ $shareUrl }}">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:image" content="{{ $imageUrl }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Chess99.com">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{{ $shareUrl }}">
    <meta name="twitter:title" content="{{ $title }}">
    <meta name="twitter:description" content="{{ $description }}">
    <meta name="twitter:image" content="{{ $imageUrl }}">

    <!-- WhatsApp specific (uses Open Graph) -->
    <meta property="og:image:alt" content="Chess game result">

    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #ffffff;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 800px;
            text-align: center;
        }
        .image-container {
            background: white;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            margin: 20px 0;
        }
        .image-container img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            display: block;
        }
        h1 {
            font-size: 2.5em;
            margin: 0 0 10px 0;
            color: #ffc107;
        }
        p {
            font-size: 1.2em;
            color: #b0b0b0;
            margin: 10px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 1.2em;
            font-weight: bold;
            margin-top: 20px;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: scale(1.05);
        }
        .loading {
            margin-top: 20px;
            font-size: 1.1em;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏆 {{ $title }} 🏆</h1>
        <p>{{ $description }}</p>

        <div class="image-container">
            <img src="{{ $imageUrl }}" alt="Chess game result">
        </div>

        <a href="{{ $frontendUrl }}" class="cta-button">
            ♟️ Play Chess at Chess99.com
        </a>
    </div>
</body>
</html>
