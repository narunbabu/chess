# PowerShell script to test lesson completion API

# Step 1: Get authentication token from database
Write-Host "Getting user token..." -ForegroundColor Cyan

$getTokenQuery = @"
SELECT tokens.token
FROM personal_access_tokens tokens
JOIN users ON tokens.tokenable_id = users.id
WHERE users.email = 'narun.iitb@gmail.com'
ORDER BY tokens.created_at DESC
LIMIT 1;
"@

cd C:\ArunApps\Chess-Web\chess-backend

# Get the token using tinker
$tokenCommand = "DB::select(`"$getTokenQuery`")[0]->token ?? null;"
$token = php artisan tinker --execute="echo $tokenCommand"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "No token found! User needs to log in first." -ForegroundColor Red
    exit 1
}

Write-Host "Token found: $($token.Substring(0, 20))..." -ForegroundColor Green

# Step 2: Test the complete lesson endpoint
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

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/tutorial/lessons/1/complete" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "`nSuccess!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "`nError!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error Message: $($_.Exception.Message)"

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}

# Step 3: Check Laravel logs for detailed error
Write-Host "`n`nChecking Laravel logs for errors..." -ForegroundColor Cyan
Get-Content "C:\ArunApps\Chess-Web\chess-backend\storage\logs\laravel.log" -Tail 50 | Select-String "Error" -Context 0,5
