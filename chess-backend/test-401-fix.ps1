# Quick test to verify 401 fix

Write-Host "`n=== Testing 401 Fix ===" -ForegroundColor Cyan

# Test unauthenticated request
Write-Host "`nTest: Unauthenticated POST (should return 401)..." -ForegroundColor Yellow

$body = @{
    title = "Test Championship"
    description = "Testing auth"
    entry_fee = 0
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

    Write-Host "❌ Expected 401, but got $($response.StatusCode)" -ForegroundColor Red
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 401) {
        Write-Host "✅ Got 401 Unauthorized (PERFECT!)" -ForegroundColor Green
        Write-Host "Error message: $($_.Exception.Message)" -ForegroundColor Gray
    } elseif ($statusCode -eq 500) {
        Write-Host "❌ Still getting 500 error (needs more debugging)" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
        Write-Host "`nCheck Laravel logs:" -ForegroundColor Yellow
        Write-Host "  tail storage/logs/laravel.log" -ForegroundColor White
    } else {
        Write-Host "❌ Got unexpected status code: $statusCode" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
