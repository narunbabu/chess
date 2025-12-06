# Securing the Visualizer for Production

## Option 1: Simple Token Protection (Quick Setup)

Add this to the **top** of `tournament_db_visualizer.html` (after `<body>` tag):

```html
<script>
// Security check for production
(function() {
    const isProduction = window.location.hostname !== 'localhost' &&
                        window.location.hostname !== '127.0.0.1';

    if (isProduction) {
        const stored = sessionStorage.getItem('admin_verified');
        if (!stored) {
            const token = prompt('Enter admin access token:');
            // Set this token in Render environment variables
            if (token !== 'REPLACE_WITH_SECURE_TOKEN') {
                document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px;">Access Denied</h1>';
                throw new Error('Unauthorized access attempt');
            }
            sessionStorage.setItem('admin_verified', 'true');
        }
    }
})();
</script>
```

**Setup:**
1. Replace `'REPLACE_WITH_SECURE_TOKEN'` with a strong random token
2. Store the token securely (password manager)
3. Each session, you'll be prompted once for the token

## Option 2: Backend Authentication (More Secure)

### Step 1: Add middleware to `chess-backend/index.js`

```javascript
// Add near the top with other middleware
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'development-token';

function requireAdminAuth(req, res, next) {
    const token = req.headers['x-admin-token'] ||
                  req.query.token ||
                  req.body.token;

    if (process.env.NODE_ENV !== 'production') {
        return next(); // Allow in development
    }

    if (token !== ADMIN_TOKEN) {
        console.warn('Unauthorized admin access attempt');
        return res.status(403).json({
            error: 'Forbidden - Admin access required'
        });
    }

    next();
}

// Protect the visualizer page
app.get('/tournament_db_visualizer.html', requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tournament_db_visualizer.html'));
});

// Protect admin API endpoints
app.post('/api/championships/:id/generate-tournament', requireAdminAuth, async (req, res) => {
    // existing code...
});
```

### Step 2: Update visualizer to send token

Add this to `tournament_db_visualizer.html` API calls:

```javascript
// Get token once
let ADMIN_TOKEN = null;

function getAdminToken() {
    if (!ADMIN_TOKEN) {
        ADMIN_TOKEN = prompt('Enter admin token:');
        if (!ADMIN_TOKEN) {
            throw new Error('Admin token required');
        }
    }
    return ADMIN_TOKEN;
}

// Update fetch calls to include token
async function generateTournamentForChampionship() {
    const response = await fetch(`/api/championships/${selectedChampionshipId}/generate-tournament?token=${getAdminToken()}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-token': getAdminToken()
        }
    });
    // rest of code...
}
```

### Step 3: Set environment variable in Render

1. Go to Render Dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add variable:
   - Key: `ADMIN_TOKEN`
   - Value: Generate a strong random token (at least 32 characters)

   Example: `admin_secure_token_k8s9d7f6g5h4j3k2l1m0n9b8v7c6x5z4`

## Option 3: Separate Branch Strategy

Keep visualizer out of production:

```bash
# Create development branch
git checkout -b development
git push -u origin development

# Add visualizer to .gitignore on main
echo "chess-backend/public/tournament_db_visualizer.html" >> .gitignore

# Only visualizer exists on development branch
# Production (main) branch doesn't have it
```

Deploy main branch to production, keep development for testing.

## Recommended Approach

**For your use case, I recommend Option 1 or 2:**

- **Option 1**: Quick, simple, good for solo developer
- **Option 2**: More secure, proper authentication
- **Option 3**: Clean but requires branch management

Choose Option 2 if you might give access to others later.
Choose Option 1 for quick setup and solo use.
