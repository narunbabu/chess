# Phase 2 Authorization Testing Script
# Run this from PowerShell in the chess-backend directory

Write-Host "`n=== Phase 2 Authorization Testing ===" -ForegroundColor Cyan
Write-Host "This script will test the authorization layer`n" -ForegroundColor Gray

# Step 1: Run the RolePermissionSeeder
Write-Host "[Step 1/5] Seeding role-permission relationships..." -ForegroundColor Yellow
php artisan db:seed --class=RolePermissionSeeder
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Seeder completed successfully`n" -ForegroundColor Green
} else {
    Write-Host "❌ Seeder failed`n" -ForegroundColor Red
    exit 1
}

# Step 2: Test gates in Tinker
Write-Host "[Step 2/5] Testing authorization gates..." -ForegroundColor Yellow
$tinkerCommands = @'
$user = App\Models\User::first();
$user->assignRole('platform_admin');
echo "Testing gates for platform_admin:\n";
echo "manage-platform: " . (Gate::forUser($user)->allows('manage-platform') ? 'TRUE' : 'FALSE') . "\n";
echo "create-championship: " . (Gate::forUser($user)->allows('create-championship') ? 'TRUE' : 'FALSE') . "\n";
echo "manage-users: " . (Gate::forUser($user)->allows('manage-users') ? 'TRUE' : 'FALSE') . "\n";
echo "issue-refunds: " . (Gate::forUser($user)->allows('issue-refunds') ? 'TRUE' : 'FALSE') . "\n";
echo "\n✅ All gates should show TRUE for platform_admin\n";
'@

Write-Host "Running Tinker tests..." -ForegroundColor Gray
$tinkerCommands | php artisan tinker
Write-Host ""

# Step 3: Get an auth token
Write-Host "[Step 3/5] Getting authentication token..." -ForegroundColor Yellow
Write-Host "Note: You need to manually get a token from your app" -ForegroundColor Gray
Write-Host "Run this in Tinker to get a token:" -ForegroundColor Gray
Write-Host '  $user = App\Models\User::first();' -ForegroundColor White
Write-Host '  $token = $user->createToken("test-token")->plainTextToken;' -ForegroundColor White
Write-Host '  echo $token;' -ForegroundColor White
Write-Host ""
$token = Read-Host "Paste your token here (or press Enter to use existing token)"
if ([string]::IsNullOrWhiteSpace($token)) {
    $token = "16|m0BNns95JWmfVMADBwaBgUfwtvpSawvXIpfov917a52467b1"
    Write-Host "Using existing token from your previous test`n" -ForegroundColor Gray
}

# Step 4: Test API endpoints
Write-Host "[Step 4/5] Testing API endpoints..." -ForegroundColor Yellow

# Test unauthenticated access
Write-Host "`nTest 1: Unauthenticated POST (should get 401)..." -ForegroundColor Cyan
$body = @{
    title = "Auth Test Championship"
    description = "Testing complete auth flow"
    entry_fee = 100
    registration_deadline = "2025-12-01T10:00:00Z"
    start_date = "2025-12-15T10:00:00Z"
    format = "swiss_only"
    swiss_rounds = 5
    match_time_window_hours = 24
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/championships" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    Write-Host "❌ Expected 401, got $($response.StatusCode)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ Got 401 Unauthorized (expected)" -ForegroundColor Green
    } else {
        Write-Host "❌ Got unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test authenticated access
Write-Host "`nTest 2: Authenticated POST with valid permissions (should get 201)..." -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "✅ Championship created successfully!" -ForegroundColor Green
    Write-Host "Championship ID: $($response.data.id)" -ForegroundColor Gray
    Write-Host "Created by user: $($response.data.created_by)" -ForegroundColor Gray
    $championshipId = $response.data.id
} catch {
    Write-Host "❌ Failed to create championship: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

# Test GET (public access)
Write-Host "`nTest 3: Public GET request (should work)..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
        -Method GET `
        -ErrorAction Stop

    Write-Host "✅ Public access working!" -ForegroundColor Green
    Write-Host "Found $($response.data.Count) championship(s)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Public GET failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Summary
Write-Host "`n[Step 5/5] Test Summary" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Phase 2 Authorization Layer Testing Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review the test results above" -ForegroundColor White
Write-Host "2. All tests should show ✅ (green checkmarks)" -ForegroundColor White
Write-Host "3. If any tests failed, check the error messages" -ForegroundColor White
Write-Host "4. Once all tests pass, proceed to Phase 3" -ForegroundColor White
Write-Host ""
Write-Host "Phase 3 will add:" -ForegroundColor Gray
Write-Host "  - Organization CRUD operations" -ForegroundColor Gray
Write-Host "  - Match controller authorization" -ForegroundColor Gray
Write-Host "  - Payment controller authorization" -ForegroundColor Gray
Write-Host "  - Admin controller authorization" -ForegroundColor Gray
Write-Host ""
