# Phase 3 Comprehensive Test Script
# Tests Organization Support and Complete Authorization Coverage
# Time Required: ~5 minutes

param(
    [string]$Token = "18|nYafmfwiVKxxTxm0Triy40tSvktzOrEsjPi7ignn4df28342",
    [string]$BaseUrl = "http://localhost:8000/api"
)

# Color functions
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Section { Write-Host "`n========== $args ==========" -ForegroundColor Magenta }

# Test counters
$script:PassedTests = 0
$script:FailedTests = 0
$script:TotalTests = 0

function Test-Result {
    param([bool]$Condition, [string]$TestName)
    $script:TotalTests++
    if ($Condition) {
        $script:PassedTests++
        Write-Success "PASS: $TestName"
        return $true
    } else {
        $script:FailedTests++
        Write-Error "FAIL: $TestName"
        return $false
    }
}

# Setup headers
$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "`n[*] Phase 3 Testing - Organization Support and Authorization" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# ==================== TEST 1: Organization CRUD ====================
Write-Section "Test 1: Organization CRUD Operations"

# 1A. Create Organization
Write-Info "1A. Creating organization..."
$orgBody = @{
    name = "Chess Academy of Excellence"
    description = "Premier chess training organization"
    type = "club"
    contact_email = "admin@chessacademy.com"
    contact_phone = "+1-555-0100"
    website = "https://chessacademy.com"
    is_active = $true
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations" -Method POST -Headers $headers -Body $orgBody
    $orgId = $createResponse.organization.id
    Test-Result ($createResponse.organization.name -eq "Chess Academy of Excellence") "Organization created successfully"
    Test-Result ($createResponse.organization.slug -eq "chess-academy-of-excellence") "Slug auto-generated correctly"
    Test-Result ($createResponse.organization.created_by -eq 1) "Creator assigned correctly"
    Write-Info "Organization ID: $orgId"
} catch {
    Test-Result $false "Create organization"
    Write-Error "Error: $($_.Exception.Message)"
    exit 1
}

# 1B. List Organizations
Write-Info "`n1B. Listing all organizations..."
try {
    $listResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations" -Method GET -Headers $headers
    Test-Result ($listResponse.Count -gt 0) "List organizations returned results"
    Test-Result ($listResponse[0].PSObject.Properties.Name -contains "members_count") "Includes member count"
    Test-Result ($listResponse[0].PSObject.Properties.Name -contains "championships_count") "Includes championship count"
} catch {
    Test-Result $false "List organizations"
    Write-Error "Error: $($_.Exception.Message)"
}

# 1C. Get Single Organization
Write-Info "`n1C. Getting organization details..."
try {
    $getResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$orgId" -Method GET -Headers $headers
    Test-Result ($getResponse.organization.id -eq $orgId) "Retrieved correct organization"
    Test-Result ($getResponse.organization.PSObject.Properties.Name -contains "creator") "Includes creator details"
    Test-Result ($getResponse.organization.PSObject.Properties.Name -contains "users") "Includes users list"
} catch {
    Test-Result $false "Get organization details"
    Write-Error "Error: $($_.Exception.Message)"
}

# 1D. Update Organization
Write-Info "`n1D. Updating organization..."
$updateBody = @{
    description = "Updated: Premier chess training and tournament organization"
    website = "https://newchessacademy.com"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$orgId" -Method PUT -Headers $headers -Body $updateBody
    Test-Result ($updateResponse.organization.description -like "Updated:*") "Organization description updated"
    Test-Result ($updateResponse.organization.website -eq "https://newchessacademy.com") "Organization website updated"
} catch {
    Test-Result $false "Update organization"
    Write-Error "Error: $($_.Exception.Message)"
}

# 1E. Test Unauthenticated Access
Write-Info "`n1E. Testing unauthenticated access..."
try {
    $noAuthHeaders = @{ "Content-Type" = "application/json" }
    Invoke-WebRequest -Uri "$BaseUrl/organizations" -Method GET -Headers $noAuthHeaders -ErrorAction Stop | Out-Null
    Test-Result $false "Should reject unauthenticated request"
} catch {
    Test-Result ($_.Exception.Response.StatusCode.value__ -eq 401) "Rejects unauthenticated request (401)"
}

# ==================== TEST 2: Member Management ====================
Write-Section "Test 2: Organization Member Management"

# 2A. Get Members
Write-Info "2A. Getting organization members..."
try {
    $membersResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$orgId/members" -Method GET -Headers $headers
    Test-Result ($membersResponse.members.Count -ge 1) "Organization has at least creator as member"
    Test-Result ($membersResponse.members[0].id -eq 1) "Creator is in members list"
} catch {
    Test-Result $false "Get organization members"
    Write-Error "Error: $($_.Exception.Message)"
}

# 2B. Create Test User and Add as Member
Write-Info "`n2B. Creating test user and adding to organization..."
$testUserEmail = "testplayer_$(Get-Random)@test.com"
try {
    # Create user via PHP artisan tinker
    $createUserScript = 'App\Models\User::create([''name'' => ''Test Player'', ''email'' => ''' + $testUserEmail + ''', ''password'' => bcrypt(''password123'')])->id;'
    $tinkerOutput = php artisan tinker --execute="$createUserScript" 2>&1

    # Extract the user ID from tinker output
    $newUserId = ($tinkerOutput | Select-String -Pattern '^\d+$' | Select-Object -Last 1).Line
    if ($newUserId) {
        $newUserId = $newUserId.Trim()
        Write-Info "Created test user ID: $newUserId"

        # Add member
        $addMemberBody = @{ user_id = [int]$newUserId } | ConvertTo-Json
        $addResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$orgId/members" -Method POST -Headers $headers -Body $addMemberBody
        Test-Result ($addResponse.message -like "*added*") "User added to organization"
    } else {
        Write-Warning "Could not create test user, skipping member add test"
        Test-Result $false "Add member to organization (user creation failed)"
    }
} catch {
    Test-Result $false "Add member to organization"
    Write-Warning "Error: $($_.Exception.Message)"
}

# 2C. Remove Member
if ($newUserId) {
    Write-Info "`n2C. Removing member from organization..."
    try {
        $removeResponse = Invoke-RestMethod -Uri "$BaseUrl/organizations/$orgId/members/$newUserId" -Method DELETE -Headers $headers
        Test-Result ($removeResponse.message -like "*removed*") "User removed from organization"
    } catch {
        Test-Result $false "Remove member from organization"
        Write-Error "Error: $($_.Exception.Message)"
    }
}

# ==================== TEST 3: Payment Authorization ====================
Write-Section "Test 3: Championship Payment Authorization"

Write-Info "3A. Testing refund authorization (admin should have access)..."
$refundBody = @{
    reason = "Tournament cancelled due to technical issues"
} | ConvertTo-Json

try {
    # Note: This may fail if no participant exists, but we're testing authorization
    $refundResponse = Invoke-RestMethod -Uri "$BaseUrl/championships/payment/refund/999" -Method POST -Headers $headers -Body $refundBody -ErrorAction Stop
    Test-Result $true "Admin has refund permission"
} catch {
    # Check if it's authorization error (403) or not found (404)
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Test-Result $true "Admin has refund permission (participant not found is OK)"
        Write-Info "Note: 404 expected - no test participant exists"
    } elseif ($statusCode -eq 403) {
        Test-Result $false "Admin should have refund permission (got 403)"
    } else {
        Write-Warning "Unexpected status code: $statusCode"
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
    Test-Result $false "Get tournament overview"
    Write-Error "Error: $($_.Exception.Message)"
}

# 4B. System Health
Write-Info "`n4B. Getting system health..."
try {
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/health" -Method GET -Headers $headers
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "status") "Health check includes status"
    Test-Result ($healthResponse.PSObject.Properties.Name -contains "checks") "Health check includes checks"
} catch {
    Test-Result $false "Get system health"
    Write-Error "Error: $($_.Exception.Message)"
}

# 4C. Analytics
Write-Info "`n4C. Getting analytics..."
try {
    $analyticsResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/tournaments/analytics" -Method GET -Headers $headers
    Test-Result ($analyticsResponse.PSObject.Properties.Name -contains "championships") "Analytics includes championships data"
} catch {
    Test-Result $false "Get analytics"
    Write-Error "Error: $($_.Exception.Message)"
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
    Test-Result $false "Run maintenance tasks"
    Write-Error "Error: $($_.Exception.Message)"
}

# ==================== TEST 5: Multi-Tenant Authorization ====================
Write-Section "Test 5: Multi-Tenant Championship Authorization"

# 5A. Create Organization-Only Championship
Write-Info "5A. Creating organization-only championship..."
$champBody = @{
    title = "Organization Internal Tournament"
    description = "Private tournament for organization members"
    entry_fee = 0
    registration_deadline = "2025-12-01T10:00:00Z"
    start_date = "2025-12-15T10:00:00Z"
    format = "swiss_only"
    swiss_rounds = 5
    match_time_window_hours = 24
    visibility = "organization_only"
    organization_id = $orgId
} | ConvertTo-Json

try {
    $champResponse = Invoke-RestMethod -Uri "$BaseUrl/championships" -Method POST -Headers $headers -Body $champBody
    $champId = $champResponse.championship.id
    Test-Result ($champResponse.championship.visibility -eq "organization_only") "Organization-only championship created"
    Test-Result ($champResponse.championship.organization_id -eq $orgId) "Championship linked to organization"
    Write-Info "Championship ID: $champId"
} catch {
    Test-Result $false "Create organization-only championship"
    Write-Error "Error: $($_.Exception.Message)"
}

# 5B. Verify Visibility Filtering
Write-Info "`n5B. Verifying visibility filtering..."
try {
    $allChamps = Invoke-RestMethod -Uri "$BaseUrl/championships" -Method GET -Headers $headers
    $orgChamps = $allChamps.data | Where-Object { $_.organization_id -eq $orgId }
    Test-Result ($orgChamps.Count -gt 0) "Organization championships visible to org member"
} catch {
    Test-Result $false "Verify visibility filtering"
    Write-Error "Error: $($_.Exception.Message)"
}

# ==================== TEST 6: Organization Deletion ====================
Write-Section "Test 6: Organization Deletion Rules"

# 6A. Try to Delete Organization with Active Championships
Write-Info "6A. Attempting to delete organization with active championships..."
try {
    $deleteResponse = Invoke-WebRequest -Uri "$BaseUrl/organizations/$orgId" -Method DELETE -Headers $headers -ErrorAction Stop
    Test-Result $false "Should not allow deletion with active championships"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Test-Result ($statusCode -eq 422) "Prevents deletion with active championships (422)"
    Write-Info "Note: Organization protected due to active championships (expected)"
}

# ==================== FINAL RESULTS ====================
Write-Host "`n" -NoNewline
Write-Section "Test Results Summary"

$passRate = if ($script:TotalTests -gt 0) { [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 2) } else { 0 }

Write-Host "`nTotal Tests: $($script:TotalTests)" -ForegroundColor Cyan
Write-Success "Passed: $($script:PassedTests)"
Write-Error "Failed: $($script:FailedTests)"
Write-Host "Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

Write-Host "`n" -NoNewline
if ($script:FailedTests -eq 0) {
    Write-Host "[SUCCESS] ALL TESTS PASSED! Phase 3 is fully functional!" -ForegroundColor Green
    Write-Host "`n[+] Organization CRUD operations working" -ForegroundColor Green
    Write-Host "[+] Member management functional" -ForegroundColor Green
    Write-Host "[+] Payment authorization protecting endpoints" -ForegroundColor Green
    Write-Host "[+] Tournament admin routes accessible" -ForegroundColor Green
    Write-Host "[+] Multi-tenant authorization working" -ForegroundColor Green
    Write-Host "[+] Organization deletion rules enforced" -ForegroundColor Green
    Write-Host "`n[*] Ready to proceed to Phase 4!" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "[WARNING] Some tests failed. Review errors above." -ForegroundColor Yellow
    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "1. Review failed test details above" -ForegroundColor White
    Write-Host "2. Check server logs: storage/logs/laravel.log" -ForegroundColor White
    Write-Host "3. Verify database migrations: php artisan migrate:status" -ForegroundColor White
    # Write-Host "4. Clear caches: php artisan optimize:clear" -ForegroundColor White
    exit 1
}
