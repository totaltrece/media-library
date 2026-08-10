[CmdletBinding()]
param(
    [string]$Source = "C:\Users\Carlos\Documents\baile-hvc",
    [string]$Destination = "C:\Users\Carlos\Documents\baile",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$videoExtensions = @(".mp4", ".m4v", ".mov", ".mkv", ".ts")

function Get-VideoCodec {
    param([string]$Path)

    $codec = & ffprobe -v error -select_streams v:0 `
        -show_entries stream=codec_name `
        -of default=noprint_wrappers=1:nokey=1 -- "$Path" 2>$null

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($codec)) {
        throw "Could not determine video codec."
    }

    $codec.Trim().ToLowerInvariant()
}

function Convert-OneVideo {
    param(
        [string]$InputPath,
        [string]$OutputPath
    )

    $outputDirectory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $temporaryOutput = "$OutputPath.converting.mp4"

    if (Test-Path -LiteralPath $temporaryOutput) {
        Remove-Item -LiteralPath $temporaryOutput -Force
    }

    & ffmpeg -hide_banner -loglevel error `
        -i "$InputPath" `
        -map 0:v:0 -map 0:a? `
        -c:v libx264 -crf 20 -preset medium `
        -c:a aac -b:a 128k `
        -map_metadata 0 `
        -movflags +faststart `
        -y "$temporaryOutput"

    if ($LASTEXITCODE -ne 0) {
        if (Test-Path -LiteralPath $temporaryOutput) {
            Remove-Item -LiteralPath $temporaryOutput -Force
        }
        throw "FFmpeg failed."
    }

    if (-not (Test-Path -LiteralPath $temporaryOutput)) {
        throw "FFmpeg reported success but produced no output file."
    }

    Move-Item -LiteralPath $temporaryOutput -Destination $OutputPath
}

Write-Host ""
Write-Host "HEVC -> H.264 conversion"
Write-Host "Source:      $Source"
Write-Host "Destination: $Destination"
if ($WhatIf) { Write-Host "MODE:        WhatIf (no files will be changed)" }
Write-Host ""

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw "ffmpeg was not found in PATH. Run 'ffmpeg -version' first."
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
    throw "ffprobe was not found in PATH. Run 'ffprobe -version' first."
}
if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Source directory does not exist: $Source"
}
if (-not (Test-Path -LiteralPath $Destination -PathType Container)) {
    if ($WhatIf) {
        Write-Host "[WOULD CREATE] $Destination"
    } else {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
}

$files = Get-ChildItem -LiteralPath $Source -File -Recurse |
    Where-Object { $videoExtensions -contains $_.Extension.ToLowerInvariant() }

Write-Host "Found $($files.Count) video file(s)."
Write-Host ""

$converted = 0
$skippedExisting = 0
$skippedNonHevc = 0
$skippedNonHevcFiles = @()
$errors = 0
$index = 0

foreach ($file in $files) {
    $index++
    $relativePath = $file.FullName.Substring($Source.TrimEnd('\').Length + 1)
    $destinationPath = Join-Path $Destination $relativePath

    Write-Host "[$index/$($files.Count)] $relativePath"

    try {
        $codec = Get-VideoCodec -Path $file.FullName
        Write-Host "  Codec: $codec"

       if ($codec -ne "hevc") {
            Write-Host "  [SKIP] Not HEVC."
            $skippedNonHevc++
            $skippedNonHevcFiles += $relativePath
            continue
        }

        if (Test-Path -LiteralPath $destinationPath) {
            Write-Host "  [SKIP] Destination already exists."
            $skippedExisting++
            continue
        }

        if ($WhatIf) {
            Write-Host "  [WOULD CONVERT] -> $destinationPath"
            $converted++
            continue
        }

        Write-Host "  Converting..."
        Convert-OneVideo -InputPath $file.FullName -OutputPath $destinationPath

        $sizeMB = [math]::Round((Get-Item -LiteralPath $destinationPath).Length / 1MB, 1)
        Write-Host "  [OK] Created $sizeMB MB"
        $converted++
    }
    catch {
        Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        $errors++
    }

    Write-Host ""
}

Write-Host "----------------------------------------"
Write-Host "Summary"
Write-Host "----------------------------------------"
Write-Host "Found:             $($files.Count)"
Write-Host "Converted/Planned: $converted"
Write-Host "Skipped existing:  $skippedExisting"
Write-Host "Skipped non-HEVC:  $skippedNonHevc"
if ($skippedNonHevcFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Non-HEVC files skipped:"
    foreach ($skippedFile in $skippedNonHevcFiles) {
        $expectedPath = Join-Path $Destination $skippedFile
        if (Test-Path -LiteralPath $expectedPath) {
            Write-Host "  [OK - EXISTS IN BAILE] $skippedFile"
        }
        else {
            Write-Host "  [MISSING FROM BAILE]  $skippedFile" -ForegroundColor Red
        }
    }
}
Write-Host "Errors:            $errors"
Write-Host ""

if ($WhatIf) {
    Write-Host "WhatIf mode: no files were created or modified."
} else {
    Write-Host "Original files in '$Source' were not modified or deleted."
}

if ($errors -gt 0) { exit 1 }
