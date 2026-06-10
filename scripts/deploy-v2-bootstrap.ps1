[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$EnvId,

  [string]$TcbCli = "tcb",

  [switch]$DeployOnly,

  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,

    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  Write-Host "==> $Description"
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$functionName = "bootstrapV2Collections"
$functionDir = Join-Path $repoRoot "cloudfunctions\$functionName"
$payload = '{"confirm":"bootstrap-v2-collections"}'

if (-not (Test-Path $functionDir)) {
  throw "Cloud function directory not found: $functionDir"
}

$tcbCommand = Get-Command $TcbCli -ErrorAction SilentlyContinue
if (-not $tcbCommand) {
  throw "CloudBase CLI '$TcbCli' was not found. Install it with: npm install -g @cloudbase/cli"
}

Push-Location $repoRoot
try {
  Invoke-Checked -Description "Copy shared cloud helpers" -Command {
    npm run copy:cloud-shared
  }

  if (-not $SkipDeploy) {
    Invoke-Checked -Description "Deploy $functionName to CloudBase env $EnvId" -Command {
      & $tcbCommand.Source fn deploy $functionName `
        --env-id $EnvId `
        --dir $functionDir `
        --force `
        --yes
    }
  }

  if (-not $DeployOnly) {
    Invoke-Checked -Description "Invoke $functionName once for V2 collection bootstrap" -Command {
      & $tcbCommand.Source fn invoke $functionName `
        --env-id $EnvId `
        --params $payload
    }
  }

  Write-Host ""
  Write-Host "V2 bootstrap command completed. Confirm the output lists these collections as created or existing:"
  Write-Host "  activity_logs"
  Write-Host "  user_role_logs"
  Write-Host "  notification_logs"
  Write-Host "  notification_subscriptions"
}
finally {
  Pop-Location
}
