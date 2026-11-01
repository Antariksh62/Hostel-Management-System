$logFile = "C:\data\mongo_start_result.txt"
"Starting MongoDB setup at $(Get-Date)..." | Out-File -FilePath $logFile

try {
    # 1. Grant NetworkService full access to C:\data\db
    "Granting permissions to C:\data\db..." | Out-File -FilePath $logFile -Append
    & icacls "C:\data\db" /grant "NT AUTHORITY\NetworkService:(OI)(CI)F" /T | Out-File -FilePath $logFile -Append

    # 2. Remove stale lock file if any
    if (Test-Path "C:\data\db\mongod.lock") {
        "Removing stale lock file..." | Out-File -FilePath $logFile -Append
        Remove-Item "C:\data\db\mongod.lock" -Force
    }

    # 3. Update mongod.cfg to use C:\data\db
    $cfgPath = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg"
    if (Test-Path $cfgPath) {
        "Updating mongod.cfg dbPath..." | Out-File -FilePath $logFile -Append
        $cfg = Get-Content $cfgPath
        $cfg = $cfg -replace 'dbPath: .*', 'dbPath: C:\data\db'
        $cfg | Set-Content $cfgPath
    }

    # 4. Enable and start MongoDB service
    "Configuring and starting MongoDB service..." | Out-File -FilePath $logFile -Append
    Set-Service -Name MongoDB -StartupType Automatic
    Start-Service -Name MongoDB
    $svc = Get-Service -Name MongoDB
    "MongoDB Service Status: $($svc.Status)" | Out-File -FilePath $logFile -Append
} catch {
    "ERROR: $($_.Exception.Message)" | Out-File -FilePath $logFile -Append
}

