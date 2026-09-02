# Verifies the Digital Asset Links file that App Links verification depends on.
#
# HTTP 200 is NOT sufficient: chess99.com is a single-page app, so an nginx
# `try_files $uri /index.html` fallback answers 200 with the SPA shell for a
# path that does not exist on disk. That is exactly the current failure mode.
# So this script asserts the things a 200-with-index.html cannot fake:
#   * Content-Type is JSON
#   * the body parses as JSON
#   * it declares an android_app target for our package
#   * it lists at least one SHA-256 fingerprint
#
# Exit code 0 = pass, 1 = fail, so it can be used as a deploy gate.
# Usage: powershell.exe -File scripts\check_assetlinks.ps1

$url = 'https://chess99.com/.well-known/assetlinks.json'
$package = 'com.chess99.app'
$failures = @()

try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
} catch {
    Write-Output ('FAIL  request failed: {0}' -f $_.Exception.Message)
    exit 1
}

Write-Output ('HTTP {0}' -f $response.StatusCode)
if ($response.StatusCode -ne 200) { $failures += "status is $($response.StatusCode), expected 200" }

$contentType = $response.Headers['Content-Type']
Write-Output ('Content-Type: {0}' -f $contentType)
if ($contentType -notmatch 'application/json') {
    $failures += "Content-Type is '$contentType', expected application/json (a text/html answer means nginx served the SPA fallback, i.e. the file is not on disk)"
}

$statements = $null
try {
    $statements = $response.Content | ConvertFrom-Json
} catch {
    $failures += 'body is not valid JSON'
}

if ($null -ne $statements) {
    $target = $statements | Where-Object {
        $_.target.namespace -eq 'android_app' -and $_.target.package_name -eq $package
    }
    if ($null -eq $target) {
        $failures += "no android_app statement for $package"
    } else {
        $fingerprints = @($target.target.sha256_cert_fingerprints)
        Write-Output ('SHA-256 fingerprints: {0}' -f $fingerprints.Count)
        foreach ($fp in $fingerprints) { Write-Output ('  {0}' -f $fp) }
        if ($fingerprints.Count -lt 1) { $failures += 'no sha256_cert_fingerprints listed' }
        # After Play App Signing enrolment there must be two: the upload key and
        # Play's own signing key. One means the Play key has not been added yet.
        if ($fingerprints.Count -eq 1) {
            Write-Output 'NOTE  only one fingerprint — append Play App Signing''s SHA-256 after enrolment and redeploy.'
        }
    }
}

Write-Output '--- body ---'
Write-Output $response.Content

if ($failures.Count -gt 0) {
    Write-Output ''
    foreach ($f in $failures) { Write-Output ('FAIL  {0}' -f $f) }
    exit 1
}

Write-Output ''
Write-Output 'PASS  assetlinks.json is served correctly.'
exit 0
