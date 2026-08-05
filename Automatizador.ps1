$folder = Read-Host "Escribe el nombre de la carpeta (ej. rap, pop, salsa, ryb)"

$dir = ".\$folder\audios"

if (-not (Test-Path $dir)) {
    Write-Host "La carpeta $dir no existe. Asegurate de escribir bien el nombre." -ForegroundColor Red
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit
}

$files = Get-ChildItem -Path $dir -Filter '*.mp3'
if ($files.Count -eq 0) {
    Write-Host "No se encontraron archivos .mp3 en $dir." -ForegroundColor Yellow
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit
}

$jsonArray = @()
$id = 1

foreach ($f in $files) {
    $oldName = $f.Name
    $basename = $f.BaseName
    
    # Extraer artista y titulo
    $parts = $basename -split ' - ', 2
    if ($parts.Length -eq 2) {
        $subtitle = $parts[0].Trim()
        $title = $parts[1].Trim()
    } else {
        $subtitle = "Unknown"
        $title = $basename.Trim()
    }
    
    # Crear un slug seguro para el archivo
    $newName = $oldName.ToLower()
    $newName = $newName -replace ' - ', '-'
    $newName = $newName -replace ' ', '-'
    
    # Quitar acentos comunes
    $newName = $newName -replace '[áàäâ]', 'a'
    $newName = $newName -replace '[éèëê]', 'e'
    $newName = $newName -replace '[íìïî]', 'i'
    $newName = $newName -replace '[óòöô]', 'o'
    $newName = $newName -replace '[úùüû]', 'u'
    $newName = $newName -replace 'ñ', 'n'
    
    $newName = $newName -replace '[^a-z0-9\.-]', ''
    $newName = $newName -replace '-+', '-'
    
    $newPath = Join-Path $f.DirectoryName $newName
    
    if ($f.FullName -ne $newPath) {
        Rename-Item -Path $f.FullName -NewName $newName
    }
    
    $obj = [ordered]@{
        id = [string]$id
        title = $title
        subtitle = $subtitle
        audioPath = "audios/$newName"
        posterPath = ""
    }
    $jsonArray += $obj
    $id++
}

$jsonArray | ConvertTo-Json -Depth 5 | Set-Content -Path ".\$folder\ringtones.json" -Encoding UTF8

Write-Host " "
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO CON EXITO" -ForegroundColor Green
Write-Host "Se procesaron $($files.Count) canciones en la carpeta '$folder'." -ForegroundColor Green
Write-Host "El archivo ringtones.json fue generado y actualizado." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " "
Write-Host "Presiona Enter para salir..."
Read-Host
