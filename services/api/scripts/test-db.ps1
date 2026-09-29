<#
.SYNOPSIS
  Start a throwaway Postgres for the backend test suite and migrate it to head.

.DESCRIPTION
  Runs pgvector/pgvector:pg16 (the same image CI uses) in a container named
  messfit-testdb on port 55432, with no volume, so removing the container
  deletes everything. Applies infra/local-db/supabase_shim.sql (the few
  Supabase objects the migrations expect), then `alembic upgrade head`.
  Needs Docker Desktop running. Never touches the real Supabase project.

.PARAMETER Reset
  Remove any existing test container first and start from an empty database.

.EXAMPLE
  ./scripts/test-db.ps1
  $env:TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/messfit_test"
  uv run pytest
#>
param([switch]$Reset)

# Not "Stop": Windows PowerShell 5.1 turns any native stderr line (alembic logs
# there) into a terminating error. Every native call is checked via $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$name = "messfit-testdb"
$port = 55432
$url = "postgresql+asyncpg://postgres:postgres@127.0.0.1:$port/messfit_test"
$apiDir = Split-Path -Parent $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker isn't running. Start Docker Desktop and try again." }

$exists = docker ps -a --filter "name=^$name$" --format "{{.Names}}"
if ($Reset -and $exists) {
    docker rm -f $name | Out-Null
    $exists = $null
}

if (-not $exists) {
    docker run -d --name $name -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=messfit_test `
        -p "${port}:5432" pgvector/pgvector:pg16 | Out-Null
    $fresh = $true
} else {
    docker start $name | Out-Null
    $fresh = $false
}

$ready = $false
foreach ($i in 1..60) {
    docker exec $name pg_isready -U postgres -d messfit_test *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Postgres in $name didn't become ready." }

if ($fresh) {
    Get-Content (Join-Path $apiDir "infra/local-db/supabase_shim.sql") -Raw |
        docker exec -i $name psql -q -U postgres -d messfit_test -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Applying the Supabase shim failed." }
}

Push-Location $apiDir
try {
    $env:DATABASE_URL = $url
    uv run alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "Migrations failed." }
} finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host ""
Write-Host "Test database ready. Run the suite with:" -ForegroundColor Green
Write-Host "  `$env:TEST_DATABASE_URL = `"$url`""
Write-Host "  uv run pytest"
