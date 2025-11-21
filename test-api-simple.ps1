# Simple PowerShell script to test lesson completion API
# YOU NEED TO PROVIDE THE TOKEN FROM BROWSER

# Instructions to get token:
# 1. Open browser console (F12)
# 2. Run: localStorage.getItem('token')
# 3. Copy the token value and paste it below

Write-Host "=== Lesson Completion API Test ===" -ForegroundColor Cyan
Write-Host ""

# PASTE YOUR TOKEN HERE (get it from browser console: localStorage.getItem('token'))
$token = Read-Host "Enter your authentication token (from browser localStorage)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "No token provided!" -ForegroundColor Red
    exit 1
}

Write-Host "`nTesting lesson completion endpoint..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

$body = @{
    score = 100
    time_spent_seconds = 60
    attempts = 1
} | ConvertTo-Json

Write-Host "`nRequest Body:" -ForegroundColor Yellow
Write-Host $body

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/tutorial/lessons/1/complete" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "`n=== ERROR ===" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error Message: $($_.Exception.Message)"

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nResponse Body:" -ForegroundColor Yellow
        try {
            $errorJson = $responseBody | ConvertFrom-Json
            Write-Host ($errorJson | ConvertTo-Json -Depth 5)
        } catch {
            Write-Host $responseBody
        }
    }
}

Write-Host "`n=== Laravel Logs (Last 100 lines with errors) ===" -ForegroundColor Cyan
Get-Content "C:\ArunApps\Chess-Web\chess-backend\storage\logs\laravel.log" -Tail 100 | Where-Object { $_ -match "ERROR|Exception|completeLesson" }
