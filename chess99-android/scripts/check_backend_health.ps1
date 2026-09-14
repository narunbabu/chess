# Confirms the backend an APK is built against is actually reachable.
#
# Each target carries the status it must answer with, so a probe that is
# supposed to be refused is still checked rather than reported as an error:
#   * /up                  Laravel's health endpoint (bootstrap/app.php), not '/health'
#   * /api/v1/health       the JSON probe the native apps read; must say "healthy"
#   * /api/v1/synthetic-players
#                          inside auth:sanctum (routes/api_v1.php), so without a
#                          token it must answer 401. A 401 proves the API router
#                          and the auth middleware are up; a 200 would mean the
#                          route lost its auth, and a 5xx/404 means it is broken.
#   * chess99.com          the web app
#
# Exit code 0 = pass, 1 = fail, so it can be used as a deploy gate.
# Usage: powershell.exe -File scripts\check_backend_health.ps1

$targets = @(
    @{ Url = 'https://api.chess99.com/up'; Expect = 200 },
    @{ Url = 'https://api.chess99.com/api/v1/health'; Expect = 200; HealthyJson = $true },
    @{ Url = 'https://api.chess99.com/api/v1/synthetic-players'; Expect = 401 },
    @{ Url = 'https://chess99.com'; Expect = 200 }
)
$failures = @()

foreach ($t in $targets) {
    $status = $null
    $body = $null
    try {
        $response = Invoke-WebRequest -Uri $t.Url -UseBasicParsing -TimeoutSec 20 -Headers @{ Accept = 'application/json' }
        $status = [int]$response.StatusCode
        $body = $response.Content
    } catch {
        # Windows PowerShell 5.1 and PowerShell 7 both throw on 4xx/5xx but
        # expose the response status on the exception.
        if ($null -ne $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            Write-Output ('FAIL {0}  request failed: {1}' -f $t.Url, $_.Exception.Message)
            $failures += "$($t.Url) request failed"
            continue
        }
    }

    if ($status -ne $t.Expect) {
        Write-Output ('FAIL {0}  HTTP {1}, expected {2}' -f $t.Url, $status, $t.Expect)
        $failures += "$($t.Url) answered $status, expected $($t.Expect)"
        continue
    }

    if ($t.HealthyJson) {
        $health = $null
        try { $health = $body | ConvertFrom-Json } catch { }
        if ($null -eq $health -or $health.status -ne 'healthy') {
            Write-Output ('FAIL {0}  HTTP {1} but status is not "healthy"' -f $t.Url, $status)
            $failures += "$($t.Url) did not report status healthy"
            continue
        }
    }

    Write-Output ('OK   {0}  HTTP {1}' -f $t.Url, $status)
}

if ($failures.Count -gt 0) {
    Write-Output ''
    foreach ($f in $failures) { Write-Output ('FAIL  {0}' -f $f) }
    exit 1
}

Write-Output ''
Write-Output 'PASS  backend is reachable and answering as expected.'
exit 0
