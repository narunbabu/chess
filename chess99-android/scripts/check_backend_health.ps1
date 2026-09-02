# Confirms the backend an APK is built against is actually reachable.
# Usage: powershell.exe -File scripts\check_backend_health.ps1
# Laravel's health endpoint is '/up' (bootstrap/app.php), not '/health'.
$targets = @(
    'https://api.chess99.com/up',
    'https://api.chess99.com/api/v1/synthetic-players',
    'https://chess99.com'
)

foreach ($url in $targets) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        Write-Output ('OK  {0}  HTTP {1}' -f $url, $response.StatusCode)
    } catch {
        Write-Output ('ERR {0}  {1}' -f $url, $_.Exception.Message)
    }
}
