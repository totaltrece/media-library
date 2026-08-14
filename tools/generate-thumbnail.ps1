param(
    [Parameter(Mandatory = $true)]
    [string]$Video,

    [int]$Percent = 50
)

if ($Percent -lt 0 -or $Percent -gt 100) {
    throw "Percent debe estar entre 0 y 100."
}

if (-not (Test-Path $Video)) {
    throw "No existe el vídeo: $Video"
}

$Video = (Resolve-Path $Video).Path
$Directory = Split-Path $Video
$BaseName = [System.IO.Path]::GetFileNameWithoutExtension($Video)
$Output = Join-Path $Directory "$BaseName.jpg"

$Duration = & ffprobe `
    -v error `
    -show_entries format=duration `
    -of default=noprint_wrappers=1:nokey=1 `
    "$Video"

if (-not $Duration) {
    throw "No se ha podido obtener la duración del vídeo."
}

$Seconds = [double]$Duration * $Percent / 100

Write-Host "Vídeo:     $BaseName"
Write-Host "Duración:  $([math]::Round([double]$Duration, 2)) s"
Write-Host "Frame:     $Percent% ($([math]::Round($Seconds, 2)) s)"
Write-Host "Salida:    $Output"

& ffmpeg `
    -y `
    -ss $Seconds `
    -i "$Video" `
    -frames:v 1 `
    -vf "scale=281:500:force_original_aspect_ratio=increase,crop=281:500" `
    -q:v 2 `
    "$Output"

if ($LASTEXITCODE -ne 0) {
    throw "FFmpeg ha fallado."
}

Write-Host "Thumbnail generado correctamente."