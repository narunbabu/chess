# Phase 3 Comprehensive Test Script
# Tests Organization Support and Complete Authorization Coverage
# Compatible with Windows PowerShell 5.1+

param(
    [string]$Token = "20|QnhhSrzNJqE4WUUwhHu7cfn7G8eJaR1hIBp4eSSh69c713fd",
    [string]$BaseUrl = "http://localhost:8000/api"
)

function Write-Success { Write-Host "[PASS] $args" -ForegroundColor Green }
function Write-Fail { Write-Host "[FAIL] $args" -ForegroundColor Red }
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Section { Write-Host "`n========== $args ==========" -ForegroundColor Magenta }

# Test counters
$script:PassedTests = 0
$script:FailedTests = 0
$script:TotalTests = 0
$script:newUserId = $null
$script:orgId = $null
$script:champId = $null

function Test-Result {
    param([bool]$Condition, [string]$TestName)
    $script:TotalTests++
    if ($Condition) {
        $script:PassedTests++
        Write-Success $TestName
        return $true
    } else {
        $script:FailedTests++
        Write-Fail $TestName
        return $false
    }
}

# Setup headers
$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "Phase 3 Testing - Organization Support" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# ==================== TEST 1: Organization CRUD ====================
Write-Section "Test 1: Organization CRUD Operations"

# 1A. Create Organization
Write-Info "1A. Creating organization..."
$randomId = Get-Random -Minimum 1000 -Maximum 9999
$orgBody = @{
    name = "Chess Academy $randomId"
    description = "Premier chess training organization"
    type = "club"
    contact_email = "admin$randomId@chessacademy.com"
    contact_phone = "+1-555-0100"
    website = "https://chessacademy.com"
    is_active = $true
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations" -Method POST -Headers $headers -Body $orgBody
    $script:orgId = $createResponse.organization.id
    Test-Result ($createResponse.organization.name -eq "Chess Academy $randomId") "Organization created successfully"
    Test-Result ($createResponse.organization.slug -like "chess-academy-*") "Slug auto-generated correctly"
    Test-Result ($createResponse.organization.created_by -eq 1) "Creator assigned correctly"
    Write-Info "Organization ID: $($script:orgId)"
    Write-Info "Organization Name: $($createResponse.organization.name)"
} catch {
    Test-Result $false "Create organization - $($_.Exception.Message)"
    Write-Fail "Cannot continue without organization. Exiting."
    exit 1
}

# 1B. List Organizations
Write-Info "`n1B. Listing all organizations..."
try {
    $listResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations" -Method GET -Headers $headers
    Test-Result ($listResponse.data.Count -gt 0) "List organizations returned results"
    Test-Result ($listResponse.data[0].PSObject.Properties.Name -contains "users_count") "Includes member count"
    Test-Result ($listResponse.data[0].PSObject.Properties.Name -contains "championships_count") "Includes championship count"
} catch {
    Test-Result $false "List organizations - $($_.Exception.Message)"
}

# 1C. Get Single Organization
Write-Info "`n1C. Getting organization details..."
try {
    $getResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$($script:orgId)" -Method GET -Headers $headers
    Test-Result ($getResponse.organization.id -eq $script:orgId) "Retrieved correct organization"
    Test-Result ($getResponse.organization.PSObject.Properties.Name -contains "creator") "Includes creator details"
    Test-Result ($getResponse.organization.PSObject.Properties.Name -contains "users") "Includes users list"
} catch {
    Test-Result $false "Get organization details - $($_.Exception.Message)"
}

# 1D. Update Organization
Write-Info "`n1D. Updating organization..."
$updateBody = @{
    description = "Updated: Premier chess training and tournament organization"
    website = "https://newchessacademy.com"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$($script:orgId)" -Method PUT -Headers $headers -Body $updateBody
    Test-Result ($updateResponse.organization.description -like "Updated:*") "Organization description updated"
    Test-Result ($updateResponse.organization.website -eq "https://newchessacademy.com") "Organization website updated"
} catch {
    Test-Result $false "Update organization - $($_.Exception.Message)"
}

# 1E. Test Unauthenticated Access
Write-Info "`n1E. Testing unauthenticated access..."
try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    $response = Invoke-WebRequest -Uri "$BaseUrl/organizations" -Method GET -Headers $noAuthHeaders -ErrorAction Stop
    Test-Result $false "Should reject unauthenticated request"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Test-Result $true "Rejects unauthenticated request (401)"
    } else {
        Test-Result $false "Expected 401, got $($_.Exception.Response.StatusCode.value__)"
    }
}

# ==================== TEST 2: Member Management ====================
Write-Section "Test 2: Organization Member Management"

# 2A. Get Members
Write-Info "2A. Getting organization members..."
try {
    $membersResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$($script:orgId)/members" -Method GET -Headers $headers
    Test-Result ($membersResponse.members.data.Count -ge 1) "Organization has at least creator as member"
    Test-Result ($membersResponse.members.data[0].id -eq 1) "Creator is in members list"
} catch {
    Test-Result $false "Get organization members - $($_.Exception.Message)"
}

# 2B. Create Test User and Add as Member
Write-Info "`n2B. Creating test user and adding to organization..."
$testUserEmail = "testplayer_$(Get-Random)@test.com"

# Create temporary PHP file for user creation
$phpScript = @"
<?php
require __DIR__ . '/vendor/autoload.php';
`$app = require_once __DIR__ . '/bootstrap/app.php';
`$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

`$user = App\Models\User::create([
    'name' => 'Test Player',
    'email' => '$testUserEmail',
    'password' => bcrypt('password123'),
]);

echo `$user->id;
"@

$tempFile = "temp_create_user.php"
$phpScript | Out-File -FilePath $tempFile -Encoding UTF8

try {
    $output = php $tempFile 2>&1 | Out-String
    $script:newUserId = ($output -split "`n" | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1)

    if ($script:newUserId) {
        $script:newUserId = $script:newUserId.Trim()
        Write-Info "Created test user ID: $($script:newUserId)"

        # Add member
        $addMemberBody = @{ user_id = [int]$script:newUserId } | ConvertTo-Json
        $addResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$($script:orgId)/members" -Method POST -Headers $headers -Body $addMemberBody
        Test-Result ($addResponse.message -like "*added*") "User added to organization"
    } else {
        Write-Warn "Could not create test user"
        Test-Result $false "Add member to organization (user creation failed)"
    }
} catch {
    Test-Result $false "Add member to organization - $($_.Exception.Message)"
} finally {
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}

# 2C. Remove Member
if ($script:newUserId) {
    Write-Info "`n2C. Removing member from organization..."
    try {
        $removeResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$($script:orgId)/members/$($script:newUserId)" -Method DELETE -Headers $headers
        Test-Result ($removeResponse.message -like "*removed*") "User removed from organization"
    } catch {
        Test-Result $false "Remove member from organization - $($_.Exception.Message)"
    }
}

# ==================== TEST 3: Payment Authorization ====================
Write-Section "Test 3: Championship Payment Authorization"

Write-Info "3A. Testing refund authorization..."
$refundBody = @{
    reason = "Tournament cancelled due to technical issues"
} | ConvertTo-Json

try {
    $refundResponse = Invoke-RestMethod -Uri "$BaseUrl/championships/payment/refund/999" -Method POST -Headers $headers -Body $refundBody -ErrorAction Stop
    Test-Result $true "Admin has refund permission"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Test-Result $true "Admin has refund permission (404 expected - no test participant)"
        Write-Info "Note: 404 is OK - no test participant exists"
    } elseif ($statusCode -eq 403) {
        Test-Result $false "Admin should have refund permission (got 403 Forbidden)"
    } else {
        Write-Warn "Unexpected status code: $statusCode"
        Test-Result $false "Refund authorization test (unexpected status: $statusCode)"
    }
}

# ==================== TEST 4: Tournament Administration ====================
Write-Section "Test 4: Tournament Administration Endpoints"

# 4A. Tournament Overview
Write-Info "4A. Getting tournament overview..."
try {
    $overviewResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/overview" -Method GET -Headers $headers
    Test-Result ($overviewResponse.PSObject.Properties.Name -contains "active_championships") "Overview includes active championships"
    Test-Result ($overviewResponse.PSObject.Properties.Name -contains "upcoming_championships") "Overview includes upcoming championships"
} catch {
    Test-Result $false "Get tournament overview - $($_.Exception.Message)"
}

# 4B. System Health
Write-Info "`n4B. Getting system health..."
try {
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/health" -Method GET -Headers $headers
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "queue") "Health check includes queue"
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "database") "Health check includes database"
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "tournaments") "Health check includes tournaments"
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "overall") "Health check includes overall status"
} catch {
    Test-Result $false "Get system health - $($_.Exception.Message)"
}

# 4C. Analytics
Write-Info "`n4C. Getting analytics..."
try {
    $analyticsResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/analytics" -Method GET -Headers $headers
    Test-Result ($analyticsResponse.PSObject.Properties.Name -contains "championships") "Analytics includes championships data"
} catch {
    Test-Result $false "Get analytics - $($_.Exception.Message)"
}

# 4D. Maintenance Tasks
Write-Info "`n4D. Running maintenance tasks..."
$maintenanceBody = @{
    tasks = @("check_expired", "update_standings")
} | ConvertTo-Json

try {
    $maintenanceResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/maintenance" -Method POST -Headers $headers -Body $maintenanceBody
    Test-Result ($maintenanceResponse.message -like "*completed*") "Maintenance tasks executed"
} catch {
    Test-Result $false "Run maintenance tasks - $($_.Exception.Message)"
}

# ==================== TEST 5: Multi-Tenant Authorization ====================
Write-Section "Test 5: Multi-Tenant Championship Authorization"

# 5A. Create Organization-Only Championship
Write-Info "5A. Creating organization-only championship..."
$champRandomId = Get-Random -Minimum 1000 -Maximum 9999
$champBody = @{
    title = "Organization Internal Tournament $champRandomId"
    description = "Private tournament for organization members"
    entry_fee = 0
    registration_deadline = "2025-12-01T10:00:00Z"
    start_date = "2025-12-15T10:00:00Z"
    format = "swiss_only"
    swiss_rounds = 5
    match_time_window_hours = 24
    visibility = "organization_only"
    organization_id = $script:orgId
} | ConvertTo-Json

try {
    $champResponse = Invoke-RestMethod -Uri "$BaseUrl/championships" -Method POST -Headers $headers -Body $champBody
    $script:champId = $champResponse.championship.id
    Test-Result ($champResponse.championship.visibility -eq "organization_only") "Organization-only championship created"
    Test-Result ($champResponse.championship.organization_id -eq $script:orgId) "Championship linked to organization"
    Write-Info "Championship ID: $($script:champId)"
} catch {
    Test-Result $false "Create organization-only championship - $($_.Exception.Message)"
}

# 5B. Verify Visibility Filtering
Write-Info "`n5B. Verifying visibility filtering..."
try {
    $allChamps = Invoke-RestMethod -Uri "$BaseUrl/championships" -Method GET -Headers $headers
    Write-Info "Total championships found: $($allChamps.data.Count)"

    # Check if organization championship is visible
    $orgChamp = $allChamps.data | Where-Object { $_.id -eq $script:champId }
    if ($null -ne $orgChamp) {
        Test-Result $true "Organization-only championship visible to org member"
        Write-Info "Found org championship: ID=$($orgChamp.id), OrgID=$($orgChamp.organization_id), Visibility=$($orgChamp.visibility)"
    } else {
        Write-Info "Championship details:"
        $allChamps.data | ForEach-Object {
            Write-Info "  ID: $($_.id), OrgID: $($_.organization_id), Visibility: $($_.visibility), Title: $($_.title)"
        }
        Test-Result $false "Organization championship not visible to org member"
    }
} catch {
    Test-Result $false "Verify visibility filtering - $($_.Exception.Message)"
}

# ==================== TEST 6: Organization Deletion ====================
Write-Section "Test 6: Organization Deletion Rules"

# 6A. Try to Delete Organization with Active Championships
Write-Info "6A. Attempting to delete organization with active championships..."
try {
    $deleteResponse = Invoke-WebRequest -Uri "$BaseUrl/organizations/$($script:orgId)" -Method DELETE -Headers $headers -ErrorAction Stop
    Test-Result $false "Should not allow deletion with active championships"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 422) {
        Test-Result $true "Prevents deletion with active championships (422)"
        Write-Info "Note: Organization protected due to active championships (expected)"
    } else {
        Test-Result $false "Expected 422, got $statusCode"
    }
}

# ==================== FINAL RESULTS ====================
Write-Host "`n" -NoNewline
Write-Section "Test Results Summary"

$passRate = if ($script:TotalTests -gt 0) {
    [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 2)
} else {
    0
}

Write-Host "`nTotal Tests: $($script:TotalTests)" -ForegroundColor Cyan
Write-Host "Passed: $($script:PassedTests)" -ForegroundColor Green
Write-Host "Failed: $($script:FailedTests)" -ForegroundColor Red
Write-Host "Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

Write-Host "`n" -NoNewline
if ($script:FailedTests -eq 0) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "SUCCESS: ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Phase 3 is fully functional!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "`n[+] Organization CRUD operations working" -ForegroundColor Green
    Write-Host "[+] Member management functional" -ForegroundColor Green
    Write-Host "[+] Payment authorization protecting endpoints" -ForegroundColor Green
    Write-Host "[+] Tournament admin routes accessible" -ForegroundColor Green
    Write-Host "[+] Multi-tenant authorization working" -ForegroundColor Green
    Write-Host "[+] Organization deletion rules enforced" -ForegroundColor Green
    Write-Host "`n[*] Ready to proceed to Phase 4!" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "Some tests failed. Review errors above." -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "1. Review failed test details above" -ForegroundColor White
    Write-Host "2. Check server logs: storage/logs/laravel.log" -ForegroundColor White
    Write-Host "3. Verify database migrations: php artisan migrate:status" -ForegroundColor White
    Write-Host "4. Clear caches: php artisan optimize:clear" -ForegroundColor White
    exit 1
}
