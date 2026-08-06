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

$jsonPath = ".\$folder\ringtones.json"
$existingJson = @()
if (Test-Path $jsonPath) {
    $existingData = Get-Content $jsonPath -Raw | ConvertFrom-Json
    if ($null -ne $existingData) {
        if ($existingData -is [array]) {
            $existingJson = $existingData
        } else {
            $existingJson = @($existingData)
        }
    }
}

$jsonArray = @()
$id = 1

foreach ($f in $files) {
    $oldName = $f.Name
    $basename = $f.BaseName
    
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
    
    # Buscar si ya existía en el JSON anterior
    $audioPathToMatch = "audios/$newName"
    $existingEntry = $existingJson | Where-Object { $_.audioPath -eq $audioPathToMatch } | Select-Object -First 1
    
    if ($null -ne $existingEntry -and $existingEntry.subtitle -ne "Unknown") {
        $title = $existingEntry.title
        $subtitle = $existingEntry.subtitle
    } else {
        # Extraer artista y titulo
        $parts = $basename -split ' - ', 2
        if ($parts.Length -eq 2) {
            $subtitle = $parts[0].Trim()
            $title = $parts[1].Trim()
        } else {
            $subtitle = "Unknown"
            $title = $basename.Trim()
        }
    }
    
    if ($f.FullName -ne $newPath) {
        if (Test-Path -LiteralPath $newPath) {
            # Si el archivo destino ya existe, borramos el original para evitar duplicados
            Remove-Item -LiteralPath $f.FullName -Force
        } else {
            Rename-Item -LiteralPath $f.FullName -NewName $newName
        }
    }
    
    $obj = [ordered]@{
        id = [string]$id
        title = $title
        subtitle = $subtitle
        audioPath = "audios/$newName"
        posterPath = ""
    }
    
    $alreadyAdded = $jsonArray | Where-Object { $_.audioPath -eq $obj.audioPath } | Select-Object -First 1
    if ($null -eq $alreadyAdded) {
        $jsonArray += $obj
        $id++
    } else {
        if ($alreadyAdded.subtitle -eq 'Unknown' -and $obj.subtitle -ne 'Unknown') {
            $alreadyAdded.title = $obj.title
            $alreadyAdded.subtitle = $obj.subtitle
        }
    }
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
