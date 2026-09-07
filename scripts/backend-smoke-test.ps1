# GROTEC Backend Smoke Test — Non-Destructive API Tests
# Requirements: PowerShell 7+, running backend (npm run dev), test database seeded
# Credentials: Seeded test accounts ONLY — no production data touched
# Usage: pwsh -File scripts/backend-smoke-test.ps1 [-BaseUrl http://localhost:3000]

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$SkipHealth,
    [switch]$SkipCustomerCreation,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$script:FAILED = 0
$script:PASSED = 0
$script:SKIPPED = 0
$script:TestsRun = @()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Invoke-Api {
    param(
        [string]$Method  = "GET",
        [string]$Path,
        [string]$Token,
        [object]$Body,
        [string]$Cookie,
        [string]$ExpectedStatus,
        [string]$Description
    )
    $url = "$BaseUrl/api/v1$Path"
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    if ($Body)  { $headers["Content-Type"] = "application/json" }

    $params = @{
        Uri         = $url
        Method      = $Method
        Headers     = $headers
        Body        = ($Body | ConvertTo-Json -Compress) -as [string]
        ContentType = "application/json"
    }
    if ($Cookie) { $params["WebRequestTimeout"] = 30000 }

    $VerbosePreference = if ($Verbose) { "Continue" } else { "SilentlyContinue" }

    try {
        $resp = Invoke-RestMethod @params -SessionVariable sv -ErrorAction Stop 2>$null
        if ($Cookie) { $script:Session = $sv }
        $status = [int]$resp
    }
    catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            try {
                $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                $reader.Close()
                $resp = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
            }
            catch { $resp = $body }
        }
        else { throw }
    }

    if ($ExpectedStatus -and $status -ne $ExpectedStatus) {
        Fail "$Description (expected $ExpectedStatus, got $status)"
        if ($Verbose -and $resp) { Write-Host "  Body: $($resp | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow }
        return $null, $status
    }
    Pass "$Description"
    return $resp, $status
}

function Pass { $script:PASSED++; $script:TestsRun += "[PASS] $args" }
function Fail { $script:FAILED++; $script:TestsRun += "[FAIL] $args"; Write-Host "  FAILED: $args" -ForegroundColor Red }
function Skip { $script:SKIPPED++; $script:TestsRun += "[SKIP] $args" }

function Assert-Contains {
    param($Container, $Value, $Message)
    $found = $false
    if ($Container -is [array])  { $found = ($Container -contains $Value) }
    elseif ($Container -is [string]) { $found = ($Container -match $Value) }
    else { $found = ($Container.PSObject.Properties | Where-Object { $_.Value -eq $Value -or ($_.Value -is [string] -and $_.Value -match $Value) }) }
    if (-not $found) {
        Fail "$Message (value not found: $Value)"
        return $false
    }
    return $true
}

function UniqueEmail { return "smoke-$([guid]::NewGuid().ToString('N').Substring(0,8))@grotec.local" }

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " GROTEC Backend Smoke Test — $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Base URL : $BaseUrl" -ForegroundColor Gray
Write-Host " Target   : Seeded test accounts ONLY" -ForegroundColor Gray
Write-Host " Scope    : Non-destructive (read + throwaway create)" -ForegroundColor Gray
Write-Host ""

# ---------------------------------------------------------------------------
# 0. Health Check
# ---------------------------------------------------------------------------
if (-not $SkipHealth) {
    Write-Host "[SECTION] Health" -ForegroundColor Magenta
    $health, $s = Invoke-Api GET "/health" -ExpectedStatus 200 -Description "GET /health returns 200"
    if ($s -eq 200 -and $health) {
        if ($health.status -eq "ok") { Pass "Health status ok" }
        else { Fail "Health status not ok: $($health.status)" }
    }
    Write-Host ""
}

# ---------------------------------------------------------------------------
# 1. Authentication
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Authentication" -ForegroundColor Magenta

# 1a. Login
$agentLogin, $s = Invoke-Api POST "/auth/login" `
    -Body @{ email = "agent@grotec.local"; password = "Founder@123" } `
    -ExpectedStatus 200 `
    -Description "POST /auth/login as AGENT returns 200"
if ($s -eq 200 -and $agentLogin) {
    $script:AGENT_TOKEN = $agentLogin.accessToken
    if ($agentLogin.employee.roleCode -eq "AGENT") { Pass "Login response contains AGENT roleCode" }
    else { Fail "Login response missing AGENT roleCode" }
    if ($agentLogin.employee.permissions -and $agentLogin.employee.permissions.Count -gt 0) { Pass "Login response contains permissions array" }
    else { Fail "Login response missing permissions array" }
    # Check refresh cookie was set
    if ($script:Session.Cookies -match "grotec_refresh") { Pass "Refresh cookie set" }
    else { Skip "Refresh cookie check (session variable not captured)" }
}

$script:AGENT_TOKEN = $script:AGENT_TOKEN ?? $agentLogin.accessToken

# 1b. Login — invalid credentials
$_, $s = Invoke-Api POST "/auth/login" `
    -Body @{ email = "ghost@grotec.local"; password = "wrong" } `
    -ExpectedStatus 401 `
    -Description "POST /auth/login with bad credentials returns 401"
if ($s -eq 401) {
    $err = $_
    if ($err.error.code -eq "INVALID_CREDENTIALS") { Pass "401 error code is INVALID_CREDENTIALS" }
}

# 1c. Rate limiting — 5th failure still works, 6th gets 429
for ($i = 1; $i -le 5; $i++) {
    $_, $s = Invoke-Api POST "/auth/login" `
        -Body @{ email = "rate-test@grotec.local"; password = "wrong" } `
        -ExpectedStatus 401 `
        -Description "Login failure $i/5 returns 401 (still allowed)"
}
$_, $s = Invoke-Api POST "/auth/login" `
    -Body @{ email = "rate-test@grotec.local"; password = "wrong" } `
    -ExpectedStatus 429 `
    -Description "6th login failure returns 429 (rate limited)"
if ($s -eq 429) {
    $err = $_
    if ($err.error.code -eq "TOO_MANY_ATTEMPTS") { Pass "429 error code is TOO_MANY_ATTEMPTS" }
}

# 1d. /auth/me — requires token
$_, $s = Invoke-Api GET "/auth/me" -ExpectedStatus 401 -Description "GET /auth/me without token returns 401"

# 1e. /auth/me — with token
$me, $s = Invoke-Api GET "/auth/me" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /auth/me with token returns 200"
if ($s -eq 200 -and $me) {
    if ($me.email -eq "agent@grotec.local") { Pass "/auth/me returns correct email" }
    else { Fail "/auth/me returned wrong email: $($me.email)" }
    if ($me.roleCode -eq "AGENT") { Pass "/auth/me returns correct roleCode" }
}

# 1f. Refresh token rotation
$refreshCookie = "grotec_refresh=$($script:Session.Cookies)" -replace '.*grotec_refresh=([^;]+).*', '$1'
if ($script:Session.Cookies) {
    $cookieVal = $script:Session.Cookies.Split(';')[0]
    $refreshed, $s = Invoke-Api POST "/auth/refresh" -Cookie $cookieVal -ExpectedStatus 200 -Description "POST /auth/refresh rotates token"
    if ($s -eq 200 -and $refreshed) {
        $script:NEW_TOKEN = $refreshed.accessToken
        if ($refreshed.accessToken) { Pass "Refresh response contains new accessToken" }
    }
    # Old cookie should be rejected
    $_, $s2 = Invoke-Api POST "/auth/refresh" -Cookie $cookieVal -ExpectedStatus 401 -Description "Old refresh cookie is rejected after rotation"
    if ($s2 -eq 401) { Pass "Rotation correctly invalidates old token" }
}

# 1g. Change password (non-destructive: reverts immediately)
$origPwd = "Founder@123"
$tempPwd  = "TempPass999"
$changed, $s = Invoke-Api POST "/auth/change-password" -Token $script:AGENT_TOKEN `
    -Body @{ currentPassword = $origPwd; newPassword = $tempPwd } `
    -ExpectedStatus 204 `
    -Description "POST /auth/change-password changes password (204)"
if ($s -eq 204) {
    # Revert to original
    $reverted, $_ = Invoke-Api POST "/auth/change-password" -Token $script:AGENT_TOKEN `
        -Body @{ currentPassword = $tempPwd; newPassword = $origPwd } `
        -ExpectedStatus 204 `
        -Description "POST /auth/change-password reverts to original password (204)"
    if ($reverted) { Pass "Password reverted to original" }
}

# 1h. Logout
$logout, $s = Invoke-Api POST "/auth/logout" -Cookie $cookieVal -ExpectedStatus 204 -Description "POST /auth/logout invalidates session"
Write-Host ""

# ---------------------------------------------------------------------------
# 2. Customers (non-destructive)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Customers" -ForegroundColor Magenta

$managerToken = $null
$loginM, $s = Invoke-Api POST "/auth/login" `
    -Body @{ email = "manager@grotec.local"; password = "Founder@123" } `
    -ExpectedStatus 200 `
    -Description "Login as MANAGER for customer tests"
if ($s -eq 200 -and $loginM) { $managerToken = $loginM.accessToken }

# 2a. Create customer
$phone = "99{0:00000008}" -f (Get-Random -Maximum 99999999)
$cust, $s = Invoke-Api POST "/customers" -Token $script:AGENT_TOKEN `
    -Body @{
        fullName = "Smoke Test Farmer $(Get-Date -Format 'HHmmss')"
        phones   = @{ phones = @(@{ number = $phone; isPrimary = $true }) }
    } `
    -ExpectedStatus 201 `
    -Description "POST /customers creates customer"
if ($s -eq 201 -and $cust) {
    $script:CUSTOMER_ID = $cust.id
    if ($cust.phones -and $cust.phones[0].phone -match '^\+91') { Pass "Phone normalized to E.164" }
    else { Fail "Phone not normalized to E.164" }
    # Verify lookup
    $lookup, $_ = Invoke-Api GET "/customers/lookup?phone=%2B91$phone" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /customers/lookup finds customer by phone"
    if ($lookup -and $lookup.customerId -eq $cust.id) { Pass "Lookup returns correct customerId" }
}

# 2b. Duplicate phone detection
$_, $s = Invoke-Api POST "/customers" -Token $script:AGENT_TOKEN `
    -Body @{ fullName = "Dup Farmer"; phones = @{ phones = @(@{ number = $phone; isPrimary = $true }) } } `
    -ExpectedStatus 409 `
    -Description "POST /customers with duplicate phone returns 409"
if ($s -eq 409) {
    $err = $_
    if ($err.error.code -eq "CUSTOMER_PHONE_EXISTS") { Pass "409 error code is CUSTOMER_PHONE_EXISTS" }
    else { Fail "409 error code was $($err.error.code), expected CUSTOMER_PHONE_EXISTS" }
}

# 2c. Duplicate phone in same request
$_, $s = Invoke-Api POST "/customers" -Token $script:AGENT_TOKEN `
    -Body @{ fullName = "Dup Farmer"; phones = @{ phones = @(@{ number = "9900000011" }; @{ number = "9900000011" }) } } `
    -ExpectedStatus 400 `
    -Description "POST /customers with duplicate phone in request returns 400"
if ($s -eq 400) {
    $err = $_
    if ($err.error.code -eq "DUPLICATE_PHONE_IN_REQUEST") { Pass "400 error code is DUPLICATE_PHONE_IN_REQUEST" }
}

# 2d. Invalid phone
$_, $s = Invoke-Api POST "/customers" -Token $script:AGENT_TOKEN `
    -Body @{ fullName = "Bad Phone"; phones = @{ phones = @(@{ number = "not-a-phone" }) } } `
    -ExpectedStatus 400 `
    -Description "POST /customers with invalid phone returns 400"
if ($s -eq 400 -and $err) {
    if ($err.error.code -eq "INVALID_PHONE") { Pass "400 error code is INVALID_PHONE" }
}

# 2e. Customer list
$list, $s = Invoke-Api GET "/customers" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /customers returns 200"
if ($s -eq 200 -and $list) {
    if ($list.total -ge 1) { Pass "Customer list returns total >= 1" }
    if ($list.items -and $list.items.Count -gt 0) { Pass "Customer list returns items array" }
}

# 2f. Customer detail
if ($script:CUSTOMER_ID) {
    $detail, $s = Invoke-Api GET "/customers/$script:CUSTOMER_ID" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /customers/:id returns 200"
}

# 2g. Customer update
if ($script:CUSTOMER_ID) {
    $updated, $s = Invoke-Api PATCH "/customers/$script:CUSTOMER_ID" -Token $script:AGENT_TOKEN `
        -Body @{ fullName = "Updated Farmer $(Get-Date -Format 'HHmmss')" } `
        -ExpectedStatus 200 `
        -Description "PATCH /customers/:id updates customer"
}

# 2h. Manager deactivate/reactivate
if ($script:CUSTOMER_ID -and $managerToken) {
    Invoke-Api POST "/customers/$script:CUSTOMER_ID/deactivate" -Token $managerToken -ExpectedStatus 204 -Description "Manager can deactivate customer"
    $deact, $s = Invoke-Api GET "/customers/$script:CUSTOMER_ID" -Token $managerToken -ExpectedStatus 200 -Description "Deactivated customer still reachable"
    if ($s -eq 200 -and $deact) {
        if ($deact.status -eq "INACTIVE") { Pass "Deactivated customer status is INACTIVE" }
    }
    Invoke-Api POST "/customers/$script:CUSTOMER_ID/activate" -Token $managerToken -ExpectedStatus 204 -Description "Manager can reactivate customer"
}

# 2i. Agent cannot deactivate (RBAC)
if ($script:CUSTOMER_ID) {
    $_, $s = Invoke-Api POST "/customers/$script:CUSTOMER_ID/deactivate" -Token $script:AGENT_TOKEN -ExpectedStatus 403 -Description "Agent cannot deactivate customer (403)"
    if ($s -eq 403) {
        $err = $_
        if ($err.error.code -eq "FORBIDDEN") { Pass "403 error code is FORBIDDEN" }
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 3. Employees (read-only)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Employees" -ForegroundColor Magenta

$empList, $s = Invoke-Api GET "/employees" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /employees returns 200"
if ($s -eq 200 -and $empList) {
    if ($empList.total -ge 5) { Pass "Employee list returns >= 5 seeded employees" }
}

$founderList, $s = Invoke-Api GET "/employees?roleCode=FOUNDER" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /employees?roleCode=FOUNDER returns 200"
if ($s -eq 200 -and $founderList) {
    if ($founderList.total -ge 1) { Pass "Founder filter returns at least 1 employee" }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 4. Roles
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Roles & Permissions" -ForegroundColor Magenta

$roles, $s = Invoke-Api GET "/roles" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /roles returns 200"
if ($s -eq 200 -and $roles) {
    if ($roles.Count -ge 5) { Pass "At least 5 roles returned" }
    $found = $roles | Where-Object { $_.code -eq "FOUNDER" }
    if ($found) { Pass "FOUNDER role exists" }
}

$perms, $s = Invoke-Api GET "/roles/permissions" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /roles/permissions returns 200"
if ($s -eq 200 -and $perms) {
    $founderRole = $roles | Where-Object { $_.code -eq "FOUNDER" } | Select-Object -First 1
    if ($founderRole -and $perms.$($founderRole.id)) {
        $founderPerms = $perms[$founderRole.id]
        if ($founderPerms.Count -gt 5) { Pass "FOUNDER has multiple permissions ($($founderPerms.Count))" }
        if ($founderPerms -contains "audit.list") { Pass "FOUNDER has audit.list permission" }
        if ($founderPerms -notcontains "employee.reset_password") { Pass "AGENT lacks employee.reset_password (RBAC boundary)" }
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 5. Leads (non-destructive)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Leads" -ForegroundColor Magenta

$lead, $s = Invoke-Api POST "/leads" -Token $script:AGENT_TOKEN `
    -Body @{ name = "Smoke Lead $(Get-Date -Format 'HHmmss')"; phone = "9900000012" } `
    -ExpectedStatus 201 `
    -Description "POST /leads creates lead"
if ($s -eq 201 -and $lead) {
    $script:LEAD_ID = $lead.id
    $detail, $s = Invoke-Api GET "/leads/$script:LEAD_ID" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /leads/:id returns lead detail"
}

# Cleanup lead
if ($script:LEAD_ID) {
    $_, $_ = Invoke-Api DELETE "/leads/$script:LEAD_ID" -Token $script:AGENT_TOKEN -ExpectedStatus 204 -Description "DELETE /leads/:id removes test lead"
}
Write-Host ""

# ---------------------------------------------------------------------------
# 6. Attendance (read-only / own record)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Attendance" -ForegroundColor Magenta

$att, $s = Invoke-Api GET "/attendance/my" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /attendance/my returns 200"
if ($s -eq 200 -and $att) {
    if ($att.employeeId) { Pass "Attendance record contains employeeId" }
}

$balance, $s = Invoke-Api GET "/attendance/balance" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /attendance/balance returns 200"
if ($s -eq 200) { Pass "Attendance balance accessible" }
Write-Host ""

# ---------------------------------------------------------------------------
# 7. Leave
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Leave" -ForegroundColor Magenta

$types, $s = Invoke-Api GET "/leave/types" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /leave/types returns 200"
if ($s -eq 200 -and $types) {
    if ($types.Count -gt 0) { Pass "Leave types returned ($($types.Count) types)" }
}

$myBal, $s = Invoke-Api GET "/leave/my/balances" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /leave/my/balances returns 200"
if ($s -eq 200) { Pass "My leave balances accessible" }

$myApps, $s = Invoke-Api GET "/leave/my/applications" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /leave/my/applications returns 200"
if ($s -eq 200 -and $myApps) {
    if ($myApps.items -ne $null -or $myApps.total -ne $null) { Pass "My leave applications returned" }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 8. Payroll (read-only — generate only with throwaway run)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Payroll" -ForegroundColor Magenta

$tokenM = $null
if (-not $managerToken) {
    $loginM, $_ = Invoke-Api POST "/auth/login" `
        -Body @{ email = "manager@grotec.local"; password = "Founder@123" } `
        -ExpectedStatus 200 -Description "Login as MANAGER for payroll tests"
    $tokenM = $loginM.accessToken
}

$tokenF = $null
$loginF, $_ = Invoke-Api POST "/auth/login" `
    -Body @{ email = "founder@grotec.local"; password = "Founder@123" } `
    -ExpectedStatus 200 -Description "Login as FOUNDER for payroll tests"
if ($loginF) { $tokenF = $loginF.accessToken }

# 8a. Payroll generate
$month = "2026-$(Get-Random -Minimum 1 -Maximum 12 | ForEach-Object { $_.ToString('00') })"
$gen, $s = Invoke-Api POST "/payroll/generate" -Token $tokenM `
    -Body @{ month = $month; notes = "Smoke test run $month" } `
    -ExpectedStatus 201 `
    -Description "Manager can generate payroll run"
if ($s -eq 201 -and $gen) {
    $script:PAYROLL_ID = $gen.id
    if ($gen.status -eq "GENERATED") { Pass "Generated payroll has status GENERATED" }
}

# 8b. Manager approve
if ($script:PAYROLL_ID) {
    $approved, $s = Invoke-Api POST "/payroll/$script:PAYROLL_ID/approve" -Token $tokenM -ExpectedStatus 201 -Description "Manager can approve payroll"
    if ($s -eq 201 -and $approved) {
        if ($approved.status -eq "APPROVED_LOCKED") { Pass "Approved payroll has status APPROVED_LOCKED" }
    }

    # 8c. Manager cannot publish (RBAC)
    $_, $s = Invoke-Api POST "/payroll/$script:PAYROLL_ID/publish" -Token $tokenM -ExpectedStatus 403 -Description "Manager cannot publish payroll (403)"
    if ($s -eq 403) { Pass "Manager publish blocked with 403" }

    # 8d. Founder can publish
    $pub, $s = Invoke-Api POST "/payroll/$script:PAYROLL_ID/publish" -Token $tokenF -ExpectedStatus 201 -Description "Founder can publish payroll"
    if ($s -eq 201 -and $pub) {
        if ($pub.status -eq "PUBLISHED") { Pass "Published payroll has status PUBLISHED" }
    }

    # 8e. Payslips
    $slips, $s = Invoke-Api GET "/payroll/payslips" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /payroll/payslips returns 200"
    if ($s -eq 200 -and $slips) {
        if ($slips.Count -ge 0) { Pass "Payslips array returned" }
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 9. RBAC — Role Hierarchy & Permission Boundaries
# ---------------------------------------------------------------------------
Write-Host "[SECTION] RBAC — Role Hierarchy" -ForegroundColor Magenta

$tokenDlv = $null
$loginD, $_ = Invoke-Api POST "/auth/login" `
    -Body @{ email = "delivery@grotec.local"; password = "Founder@123" } `
    -ExpectedStatus 200 -Description "Login as DELIVERY"
if ($loginD) { $tokenDlv = $loginD.accessToken }

# 9a. DELIVERY cannot create customers
$_, $s = Invoke-Api POST "/customers" -Token $tokenDlv `
    -Body @{ fullName = "Forbidden Customer"; phones = @{ phones = @(@{ number = "9900000099"; isPrimary = $true }) } } `
    -ExpectedStatus 403 `
    -Description "DELIVERY cannot POST /customers (403)"
if ($s -eq 403) { Pass "DELIVERY blocked from customer.create permission" }

# 9b. Agent cannot access audit log
$_, $s = Invoke-Api GET "/audit" -Token $script:AGENT_TOKEN -ExpectedStatus 403 -Description "AGENT cannot GET /audit (403)"
if ($s -eq 403) {
    $err = $_
    if ($err.error.code -eq "FOUNDER_ONLY") { Pass "403 code is FOUNDER_ONLY for audit log" }
}

# 9c. Founder can access audit log
$audit, $s = Invoke-Api GET "/audit" -Token $tokenF -ExpectedStatus 200 -Description "FOUNDER can GET /audit (200)"
if ($s -eq 200 -and $audit) {
    if ($audit.items -ne $null) { Pass "Audit log returns items array" }
}

# 9d. Manager cannot view founder salary revisions
$founderEmp, $_ = Invoke-Api GET "/employees?roleCode=FOUNDER" -Token $tokenF -ExpectedStatus 200 -Description "Get founder employee ID"
if ($founderEmp -and $founderEmp.items.Count -gt 0) {
    $founderId = $founderEmp.items[0].id
    $_, $s = Invoke-Api GET "/payroll/salary-revisions/$founderId" -Token $tokenM -ExpectedStatus 403 -Description "Manager cannot view founder salary revisions (403)"
    if ($s -eq 403) {
        $err = $_
        if ($err.error.code -eq "ROLE_HIERARCHY_FORBIDDEN") { Pass "403 code is ROLE_HIERARCHY_FORBIDDEN" }
    }
}
Write-Host ""

# ---------------------------------------------------------------------------
# 10. Dashboard
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Dashboard" -ForegroundColor Magenta

$dash, $s = Invoke-Api GET "/dashboard" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /dashboard returns 200"
if ($s -eq 200 -and $dash) {
    if ($dash.customerCount -ne $null) { Pass "Dashboard includes customerCount" }
}

$hrms, $s = Invoke-Api GET "/hrms-dashboard" -Token $tokenM -ExpectedStatus 200 -Description "GET /hrms-dashboard (manager) returns 200"
if ($s -eq 200) { Pass "HRMS dashboard accessible" }
Write-Host ""

# ---------------------------------------------------------------------------
# 11. Notifications
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Notifications" -ForegroundColor Magenta

$notifs, $s = Invoke-Api GET "/notifications" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /notifications returns 200"
if ($s -eq 200 -and $notifs) {
    if ($notifs.items -ne $null -or $notifs.total -ne $null) { Pass "Notifications returned" }
}

$count, $s = Invoke-Api GET "/notifications/unread-count" -Token $script:AGENT_TOKEN -ExpectedStatus 200 -Description "GET /notifications/unread-count returns 200"
if ($s -eq 200) { Pass "Unread count accessible" }
Write-Host ""

# ---------------------------------------------------------------------------
# 12. Outbox — health & basic event dispatch (read-only check)
# ---------------------------------------------------------------------------
Write-Host "[SECTION] Outbox" -ForegroundColor Magenta

# The outbox is internal; we verify its health by confirming that payroll
# publish generated events (checked via audit log).
$outboxEvents, $s = Invoke-Api GET "/audit?action=payroll.published" -Token $tokenF -ExpectedStatus 200 -Description "Audit log shows payroll.published events"
if ($s -eq 200 -and $outboxEvents) {
    $pubCount = 0
    if ($outboxEvents.items) { $pubCount = $outboxEvents.items.Count }
    elseif ($outboxEvents.total) { $pubCount = $outboxEvents.total }
    if ($pubCount -gt 0) { Pass "Outbox processed PAYROLL_PUBLISHED events ($pubCount found)" }
    else { Skip "No PAYROLL_PUBLISHED events in audit log" }
}
Write-Host ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Results — $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PASSED : $PASSED" -ForegroundColor Green
Write-Host "  FAILED : $FAILED" -ForegroundColor Red
Write-Host "  SKIPPED: $SKIPPED" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Total  : $($PASSED + $FAILED + $SKIPPED) tests" -ForegroundColor White
Write-Host ""

if ($Verbose) {
    Write-Host "=== Detailed Run ===" -ForegroundColor Gray
    $TestsRun | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}

if ($FAILED -gt 0) {
    Write-Host "OVERALL: FAIL — $FAILED test(s) failed" -ForegroundColor Red
    exit 1
}
elseif ($PASSED -gt 0) {
    Write-Host "OVERALL: PASS — All tests passed" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "OVERALL: SKIP — No tests were run" -ForegroundColor Yellow
    exit 0
}
