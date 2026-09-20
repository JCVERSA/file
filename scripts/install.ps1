# File Share installer (Windows PowerShell)
#
# Usage:
#   irm https://raw.githubusercontent.com/JCVERSA/file/main/scripts/install.ps1 | iex
#
# Or download and run directly:
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-Update] [-DryRun] [-Force]
param(
    [switch]$Update,
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference   = 'Stop'
$ProgressPreference      = 'SilentlyContinue'

$Repo       = 'JCVERSA/file'
$Branch     = 'main'
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$RawBase    = "https://raw.githubusercontent.com/$Repo/$Branch"
$DataDir    = Join-Path $env:LOCALAPPDATA 'FileShare'
$InstallDir = Join-Path $DataDir 'current'
$BackupDir  = Join-Path $DataDir 'backups'
$BinDir     = Join-Path $env:USERPROFILE 'bin'
$Command    = 'fsd.cmd'
$TempRoot   = Join-Path ([System.IO.Path]::GetTempPath()) ("fsd-install-" + [guid]::NewGuid().ToString('N'))

function Info($m) { Write-Host "[INFO] $m" }
function Ok($m)   { Write-Host "[OK] $m"   -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) {
    Write-Host "[ERROR] $m" -ForegroundColor Red
    if (Test-Path variable:\_) { Write-Host "At: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor DarkGray }
    exit 1
}

if ($Help) {
    @"
File Share installer (Windows)

Install or update:
  irm https://raw.githubusercontent.com/$Repo/$Branch/scripts/install.ps1 | iex

Options when run directly:
  -Update    Explicit update mode
  -DryRun    Download and validate without installing
  -Force     Reinstall even when the same version is installed
"@
    exit 0
}

New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
try {
    # --- 1. Node.js >= 22 --------------------------------------------------
    Info "Checking Node.js (>= 22)..."
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $major = (& node -v).TrimStart('v').Split('.')[0]
        if ([int]$major -lt 22) {
            Warn "Node.js $(& node -v) is too old (>= 22 required). Installing Node.js LTS via winget..."
            & winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements *>$null
            if ($LASTEXITCODE -ne 0) { Fail 'Node.js LTS installation failed. Install Node 22+ from https://nodejs.org and rerun.' }
            $node = Get-Command node -ErrorAction SilentlyContinue
            if (-not $node) { Fail 'Node.js still not found after install. Open a new shell and rerun.' }
        }
        Ok "node $(& node -v) / npm $(& npm -v)"
    } else {
        Info "Node.js not found - installing Node.js LTS via winget..."
        & winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements *>$null
        if ($LASTEXITCODE -ne 0) { Fail 'Node.js LTS installation failed. Install Node 22+ from https://nodejs.org and rerun.' }
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) { Fail 'Node.js still not found after install. Open a new shell and rerun.' }
        Ok "node $(& node -v) installed."
    }

    # --- 2. Download + extract --------------------------------------------
    $archive = Join-Path $TempRoot 'file-share.zip'
    $extract = Join-Path $TempRoot 'extracted'
    $stage   = Join-Path $TempRoot 'staged'

    Info "Downloading File Share from $Repo/$Branch..."
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force

    $project = Get-ChildItem -LiteralPath $extract -Directory | Where-Object {
        (Test-Path (Join-Path $_.FullName 'package.json')) -and
        (Test-Path (Join-Path $_.FullName 'server.ts'))
    } | Select-Object -First 1
    if (-not $project) { Fail 'Downloaded archive does not contain a valid File Share project.' }

    # --- 3. Stage the project ---------------------------------------------
    New-Item -ItemType Directory -Force -Path $DataDir, $BackupDir, $BinDir, $stage | Out-Null
    Copy-Item -Path (Join-Path $project.FullName '*') -Destination $stage -Recurse -Force
    Remove-Item -LiteralPath (Join-Path $stage 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $stage 'dist')          -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $stage 'shared_files')  -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $stage '.git')          -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path (Join-Path $stage '.fsd') | Out-Null

    if ($DryRun) {
        Ok "Validated File Share ($Branch). No changes made."
        exit 0
    }

    # --- 4. npm install + build (in the staged copy) ----------------------
    Info "Installing dependencies and building (this takes a few minutes)..."
    Push-Location $stage
    try {
        & npm install --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }
        & npm run build
        if ($LASTEXITCODE -ne 0) { Fail 'npm run build failed.' }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path (Join-Path $stage 'dist\server.mjs'))) {
        Fail 'Build did not produce dist\server.mjs.'
    }

    # --- 5. .env (preserve existing) --------------------------------------
    if (-not (Test-Path $InstallDir)) { $envFile = '' } else { $envFile = Join-Path $InstallDir '.env' }
    if (-not ($envFile -and (Test-Path $envFile))) {
        Copy-Item -LiteralPath (Join-Path $stage '.env.example') -Destination (Join-Path $stage '.env') -Force
        Ok '.env created from the example.'
    }

    # --- 6. Backup + atomic swap ------------------------------------------
    $backup = $null
    if (Test-Path $InstallDir) {
        $suffix = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = Join-Path $BackupDir $suffix
        Move-Item -LiteralPath $InstallDir -Destination $backup -Force
    }
    try { Move-Item -LiteralPath $stage -Destination $InstallDir -Force }
    catch {
        if ($backup -and (Test-Path $backup)) { Move-Item -LiteralPath $backup -Destination $InstallDir -Force }
        Fail 'Could not activate the new installation. Previous version was restored when possible.'
    }
    # Restore the user's existing .env/data over the fresh install.
    if ($envFile -and (Test-Path $envFile)) {
        Copy-Item -LiteralPath $envFile -Destination (Join-Path $InstallDir '.env') -Force
    }
    if ($backup) {
        foreach ($keep in @('shared_files')) {
            $from = Join-Path $backup $keep
            $to   = Join-Path $InstallDir $keep
            if ((Test-Path $from) -and -not (Test-Path $to)) {
                Move-Item -LiteralPath $from -Destination $to -Force
            }
        }
    }

    # --- 7. Launcher fsd.cmd ----------------------------------------------
    $fsdCmd = Join-Path $BinDir $Command
@'
@echo off
rem File Share launcher (fsd) - generated by install.ps1
setlocal
set "FS_HOME=__INSTALL_DIR__"
if not exist "%FS_HOME%\dist\server.mjs" goto CHECK_SETUP
goto CHECK_SETUP

:CHECK_SETUP
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH. Install Node 22+ and reopen the shell.
  exit /b 1
)

if "%~1"=="" goto HELP
if /I "%~1"=="setup"     goto SETUP
if /I "%~1"=="build"     goto BUILD
if /I "%~1"=="start"     goto START
if /I "%~1"=="stop"      goto STOP
if /I "%~1"=="restart"   goto RESTART
if /I "%~1"=="status"    goto STATUS
if /I "%~1"=="dev"       goto DEV
if /I "%~1"=="logs"      goto LOGS
if /I "%~1"=="env"       goto ENV
if /I "%~1"=="update"    goto UPDATE
if /I "%~1"=="version"   goto VERSION
if /I "%~1"=="uninstall" goto UNINSTALL
if /I "%~1"=="help"      goto HELP
goto HELP

:SETUP
  pushd "%FS_HOME%"
  call npm install --legacy-peer-deps
  if errorlevel 1 goto ERR
  call npm run build
  if errorlevel 1 goto ERR
  popd
  echo [OK] Setup complete.
  goto END

:BUILD
  pushd "%FS_HOME%"
  call npm run build
  popd
  if errorlevel 1 goto ERR
  echo [OK] Build complete.
  goto END

:START
  if not exist "%FS_HOME%\dist\server.mjs" (
    echo [ERROR] dist\server.mjs missing - run: fsd setup
    exit /b 1
  )
  if not exist "%FS_HOME%\.fsd" mkdir "%FS_HOME%\.fsd"
  start "" /b cmd /c "cd /d "%FS_HOME%" && node dist\server.mjs >> .fsd\server.log 2>&1"
  echo [OK] Server starting (production). Log: fsd logs
  goto END

:STOP
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*dist\server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
  echo [OK] Stopped (if running).
  goto END

:RESTART
  call :STOP
  call :START
  goto END

:STATUS
  powershell -NoProfile -Command "try { Invoke-RestMethod 'http://127.0.0.1:3000/api/status' | ConvertTo-Json } catch { Write-Host '[ERROR] Server not reachable on port 3000 (is it running?)' }"
  goto END

:DEV
  pushd "%FS_HOME%"
  call npm run dev
  popd
  goto END

:LOGS
  if not exist "%FS_HOME%\.fsd\server.log" (
    echo [INFO] No log yet - start the server first.
    exit /b 0
  )
  powershell -NoProfile -Command "Get-Content '%FS_HOME%\.fsd\server.log' -Tail 50"
  goto END

:ENV
  if not exist "%FS_HOME%\.env" copy "%FS_HOME%\.env.example" "%FS_HOME%\.env"
  notepad "%FS_HOME%\.env"
  goto END

:UPDATE
  powershell -NoProfile -ExecutionPolicy Bypass -File "%FS_HOME%\update.ps1"
  goto END

:VERSION
  echo File Share at %FS_HOME%
  goto END

:UNINSTALL
  powershell -NoProfile -ExecutionPolicy Bypass -File "%FS_HOME%\uninstall.ps1"
  goto END

:HELP
  echo.
  echo fsd - File Share manager
  echo   fsd setup      install deps + build
  echo   fsd build      rebuild dist\server.mjs
  echo   fsd start      start production server (background)
  echo   fsd stop       stop the server
  echo   fsd restart    restart the server
  echo   fsd status     share stats (port 3000)
  echo   fsd dev        Vite dev server (foreground)
  echo   fsd logs       tail the server log
  echo   fsd env        edit .env (notepad)
  echo   fsd update     self-update
  echo   fsd uninstall  remove File Share
  echo.
  goto END

:ERR
  popd
  echo [ERROR] Command failed.
  exit /b 1

:END
endlocal
'@ | Set-Content -LiteralPath $fsdCmd -Encoding ASCII
    (Get-Content -LiteralPath $fsdCmd -Raw).Replace('__INSTALL_DIR__', $InstallDir) | Set-Content -LiteralPath $fsdCmd -Encoding ASCII

    # --- 8. Self-updater + uninstaller (embedded) -------------------------
    $updatePs1 = Join-Path $InstallDir 'update.ps1'
@'
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
& ([scriptblock]::Create((Invoke-RestMethod '__RAW_BASE__/scripts/install.ps1'))) -Update
'@.Replace('__RAW_BASE__', $RawBase) | Set-Content -LiteralPath $updatePs1 -Encoding UTF8

    $uninstallPs1 = Join-Path $InstallDir 'uninstall.ps1'
@'
Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'
$InstallDir = '__INSTALL_DIR__'
$BinDir     = Join-Path $env:USERPROFILE 'bin'
$fsdCmd     = Join-Path $BinDir 'fsd.cmd'

# Stop the running server (node running dist\server.mjs under the install dir).
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*$InstallDir*" -and $_.CommandLine -like '*dist\server.mjs*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Remove-Item -LiteralPath $fsdCmd -Force -ErrorAction SilentlyContinue

$ask = Read-Host 'Remove shared files too? [y/N]'
if ($ask -match '^[Yy]') { Remove-Item -LiteralPath (Join-Path $InstallDir 'shared_files') -Recurse -Force }

# Remove the PATH entry (User scope) added for %USERPROFILE%\bin.
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if ($userPath -and ($userPath -split ';') -contains $BinDir) {
    $clean = ($userPath -split ';' | Where-Object { $_ -ne $BinDir }) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $clean, 'User')
}

Remove-Item -LiteralPath $InstallDir -Recurse -Force
Write-Host '[OK] File Share removed.' -ForegroundColor Green
if ($ask -notmatch '^[Yy]') { Write-Host '[INFO] Your shared files were not modified.' }
'@.Replace('__INSTALL_DIR__', $InstallDir) | Set-Content -LiteralPath $uninstallPs1 -Encoding UTF8

    # --- 9. PATH ----------------------------------------------------------
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (($userPath -split ';') -contains $BinDir)) {
        $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $BinDir } else { "$userPath;$BinDir" }
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Warn "$BinDir was added to your user PATH. Reopen the terminal to use fsd."
    }
    if (($env:Path -split ';') -notcontains $BinDir) { $env:Path = "$BinDir;$env:Path" }

    Ok "File Share installed."
    Ok "Command: fsd"
    Write-Host ''
    Write-Host '  fsd setup       first-time dependency install + build'
    Write-Host '  fsd start       start the share server (background)'
    Write-Host '  fsd status      share stats'
    Write-Host '  fsd env         set SHARE_PASSWORD in .env (notepad)'
    Write-Host ''
    Write-Host 'Default password: open .env and set SHARE_PASSWORD, then fsd restart'
    Write-Host '  (the server prints a random one at first boot otherwise)'
}
finally {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
