$folder = "reggaeton"
$jsonPath = ".\$folder\ringtones.json"
$targetCount = 302

if (-not (Test-Path $jsonPath)) {
    Write-Host "No se encontro el archivo $jsonPath" -ForegroundColor Red
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit
}

$original = Get-Content $jsonPath -Raw | ConvertFrom-Json
$newArray = @()
$idCounter = 1

Write-Host "Multiplicando las canciones de $folder para llegar a $targetCount..." -ForegroundColor Yellow

while ($newArray.Count -lt $targetCount) {
    foreach ($item in $original) {
        if ($newArray.Count -ge $targetCount) { break }
        
        $newItem = [ordered]@{
            id = [string]$idCounter
            title = "$($item.title) (Copia $idCounter)"
            subtitle = $item.subtitle
            audioPath = $item.audioPath
            posterPath = $item.posterPath
        }
        $newArray += $newItem
        $idCounter++
    }
}

$newArray | ConvertTo-Json -Depth 5 | Set-Content $jsonPath -Encoding UTF8

Write-Host " "
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO CON EXITO" -ForegroundColor Green
Write-Host "El archivo ringtones.json de $folder ahora tiene $targetCount canciones." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " "
Write-Host "Presiona Enter para salir..."
Read-Host
