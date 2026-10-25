$ErrorActionPreference = "Stop"

function Import-DotEnv([string] $path) {
  foreach ($rawLine in Get-Content -Path $path) {
    $line = $rawLine.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) {
      continue
    }

    $separator = $line.IndexOf("=")
    if ($separator -lt 1) {
      continue
    }

    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
  }
}

function ShouldStartSshTunnel {
  if ($env:DATABASE_ENGINE -ne "mariadb") {
    return $false
  }

  $hostName = $env:MARIADB_HOST
  return $hostName -eq "127.0.0.1" -or $hostName -eq "localhost"
}

function Get-MariadbPort {
  if ([string]::IsNullOrWhiteSpace($env:MARIADB_PORT)) {
    return 3306
  }

  return [int]$env:MARIADB_PORT
}

function Get-SshTunnelTarget {
  if (-not [string]::IsNullOrWhiteSpace($env:SSH_TUNNEL_HOST)) {
    return $env:SSH_TUNNEL_HOST
  }

  return "root@82.223.103.205"
}

function Get-SshTunnelKey {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($env:SSH_TUNNEL_KEY)) {
    $candidates += $env:SSH_TUNNEL_KEY
  }

  $candidates += @(
    (Join-Path $env:USERPROFILE ".ssh\id_ed25519_rsync"),
    (Join-Path $env:USERPROFILE ".ssh\id_ed25519"),
    (Join-Path $env:USERPROFILE ".ssh\id_rsa")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($env:SSH_TUNNEL_KEY)) {
    Write-Host "SSH_TUNNEL_KEY not found ($($env:SSH_TUNNEL_KEY)); trying password if set."
  }

  return $null
}

function Get-SshTunnelPassword {
  if ([string]::IsNullOrWhiteSpace($env:SSH_TUNNEL_PASSWORD)) {
    return $null
  }

  return $env:SSH_TUNNEL_PASSWORD
}

function Read-ProcessLog([string] $path) {
  if (-not (Test-Path -LiteralPath $path)) {
    return ""
  }

  $text = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  return $text.Trim()
}

function Test-LocalPortOpen([int] $port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect("127.0.0.1", $port)
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Start-MariadbSshTunnel {
  $port = Get-MariadbPort
  $target = Get-SshTunnelTarget

  if (Test-LocalPortOpen $port) {
    Write-Host "MariaDB already reachable on 127.0.0.1:$port"
    return $null
  }

  $key = Get-SshTunnelKey
  $password = Get-SshTunnelPassword
  if ($null -eq $key -and $null -eq $password) {
    throw "No SSH key file and SSH_TUNNEL_PASSWORD is empty. Set SSH_TUNNEL_PASSWORD in backend/.env (server SSH password, not MariaDB)."
  }

  $sshArgs = @(
    "-N",
    "-o", "ExitOnForwardFailure=yes",
    "-L", "${port}:127.0.0.1:${port}"
  )
  if ($null -ne $key) {
    $sshArgs += @("-i", $key, "-o", "IdentitiesOnly=yes")
    Write-Host "Starting SSH tunnel $target -> 127.0.0.1:$port (key $key)"
  } else {
    $sshArgs += @(
      "-o", "PreferredAuthentications=password,keyboard-interactive",
      "-o", "PubkeyAuthentication=no",
      "-o", "NumberOfPasswordPrompts=1"
    )
    Write-Host "Starting SSH tunnel $target -> 127.0.0.1:$port (password from SSH_TUNNEL_PASSWORD)"
    $env:SSH_ASKPASS = Join-Path $PSScriptRoot "ssh-tunnel-askpass.cmd"
    $env:SSH_ASKPASS_REQUIRE = "force"
    $env:DISPLAY = "127.0.0.1:0"
  }

  if ($null -eq $password) {
    $sshArgs += @("-o", "BatchMode=yes")
  }

  $sshArgs += $target
  $logDirectory = Join-Path $env:TEMP "media-library"
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $stderrFile = Join-Path $logDirectory "ssh-tunnel.err"
  $stdoutFile = Join-Path $logDirectory "ssh-tunnel.out"
  Remove-Item -LiteralPath $stderrFile, $stdoutFile -ErrorAction SilentlyContinue

  $process = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -PassThru -NoNewWindow -RedirectStandardError $stderrFile -RedirectStandardOutput $stdoutFile

  for ($attempt = 0; $attempt -lt 25; $attempt += 1) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      $details = @(Read-ProcessLog $stderrFile; Read-ProcessLog $stdoutFile) -join "`n"
      if ([string]::IsNullOrWhiteSpace($details)) {
        $details = "ssh exited with code $($process.ExitCode). Set SSH_TUNNEL_HOST and SSH_TUNNEL_KEY or SSH_TUNNEL_PASSWORD."
      }
      throw "SSH tunnel failed: $details"
    }
    if (Test-LocalPortOpen $port) {
      Write-Host "SSH tunnel ready on 127.0.0.1:$port"
      return $process
    }
  }

  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "Timed out waiting for SSH tunnel on 127.0.0.1:$port"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envFile = Join-Path $repoRoot "backend\.env"
if (Test-Path $envFile) {
  Import-DotEnv $envFile
}

$sshProcess = $null

try {
  if (ShouldStartSshTunnel) {
    $sshProcess = Start-MariadbSshTunnel
  } else {
    Write-Host "DATABASE_ENGINE=$($env:DATABASE_ENGINE); skipping SSH tunnel"
  }

  pnpm --filter @media-library/backend dev
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($null -ne $sshProcess -and -not $sshProcess.HasExited) {
    Stop-Process -Id $sshProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
